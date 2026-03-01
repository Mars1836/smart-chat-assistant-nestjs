import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { Chatbot } from './entities/chatbot.entity';
import { Message } from '../messages/entities/message.entity';
import { RagService } from '../rag/rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { LLMMessage } from '../../common/interfaces/llm-provider.interface';
import { buildCardsFromToolResults } from './card-mappers';
import { BillingService } from '../billing/billing.service';

type GeminiMessage = {
  role: 'user' | 'assistant' | 'function';
  content?: string;
  functionResponse?: { name: string; response: any };
  functionCall?: { name: string; args: any };
};

type GeminiFunctionCall = { name: string; args: any };

const ChatGraphState = Annotation.Root({
  workspaceId: Annotation<string>,
  chatbotId: Annotation<string>,
  userId: Annotation<string>,
  conversationId: Annotation<string>,
  userMessage: Annotation<string>,
  chatbot: Annotation<Chatbot>,

  tools: Annotation<any[]>({
    reducer: (_left: any[], right: any[]) => right,
    default: () => [],
  }),

  systemInstruction: Annotation<string>,

  geminiMessages: Annotation<GeminiMessage[]>({
    reducer: (left: GeminiMessage[], right: GeminiMessage | GeminiMessage[]) => {
      if (Array.isArray(right)) return left.concat(right);
      return left.concat([right]);
    },
    default: () => [],
  }),

  functionCalls: Annotation<GeminiFunctionCall[] | null>({
    reducer: (_left: GeminiFunctionCall[] | null, right: GeminiFunctionCall[] | null) =>
      right,
    default: () => null,
  }),

  finalResponse: Annotation<string>({
    reducer: (_left: string, right: string) => right,
    default: () => '',
  }),

  turn: Annotation<number>({
    reducer: (_left: number, right: number) => right,
    default: () => 0,
  }),

  files: Annotation<any[]>({
    reducer: (left: any[], right: any[]) => {
      if (Array.isArray(right)) return left.concat(right);
      return left.concat([right]);
    },
    default: () => [],
  }),

  maxTurns: Annotation<number>({
    reducer: (_left: number, right: number) => right,
    default: () => 5,
  }),

  /** Content extracted from attached images by plugin (e.g. OCR); only this is sent to the main model, not image URLs */
  extractedImageContent: Annotation<string>({
    reducer: (_left: string, right: string) => right ?? '',
    default: () => '',
  }),

  /** Số vòng đã chạy tools (router -> execute_tools). Dùng để giới hạn retry tools. */
  toolRunCount: Annotation<number>({
    reducer: (_left: number, right: number) => right,
    default: () => 0,
  }),

  /** Cards chung (product / article / link) từ tool để FE render card có ảnh + link */
  cards: Annotation<any[]>({
    reducer: (_left: any[], right: any[]) => (Array.isArray(right) ? right : []),
    default: () => [],
  }),

  /** Tích lũy token usage qua router + answer (để lưu vào message). */
  totalInputTokens: Annotation<number>({
    reducer: (left: number, right: number) => left + (right ?? 0),
    default: () => 0,
  }),
  totalOutputTokens: Annotation<number>({
    reducer: (left: number, right: number) => left + (right ?? 0),
    default: () => 0,
  }),

  /** Danh sách tools đã gọi và kết quả (để lưu vào message). */
  toolsUsedLog: Annotation<{ tool_name: string; args: Record<string, any>; result: any }[]>({
    reducer: (left, right) =>
      left.concat(Array.isArray(right) ? right : []),
    default: () => [],
  }),
});

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);

  private readonly graph = new StateGraph(ChatGraphState)
    .addNode('prepare_tools', async (state: typeof ChatGraphState.State) => {
      const tools = await this.toolRegistryService.formatForLLMWithPermissions(
        state.chatbotId,
      );
      return { tools };
    })
    .addNode('prepare_history', async (state: typeof ChatGraphState.State) => {
      const history = await this.messageRepo.find({
        where: { conversation: { id: state.conversationId } },
        order: { created_at: 'DESC' },
        take: state.chatbot.max_context_turns * 2,
      });
      history.reverse();

      const mapped: GeminiMessage[] = history.map((msg) => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Ensure last message is the current user message; append plugin-extracted image content when present (images are processed by plugin, not sent to model)
      const last = mapped.at(-1);
      let currentUserContent = state.userMessage;
      if (state.extractedImageContent?.trim()) {
        currentUserContent +=
          '\n\n[Content from attached image(s)]: ' +
          state.extractedImageContent.trim();
      }
      if (!last || last.role !== 'user' || last.content !== state.userMessage) {
        mapped.push({ role: 'user', content: currentUserContent });
      } else {
        mapped[mapped.length - 1].content = currentUserContent;
      }

      return { geminiMessages: mapped };
    })
    .addNode(
      'prepare_knowledge',
      async (state: typeof ChatGraphState.State) => {
        // Không auto gọi RAG nữa.
        // Chỉ build system instruction cơ bản, để LLM tự quyết định dùng tool knowledge_search khi cần.
        const systemInstruction = this.buildSystemInstruction(state.chatbot);
        return { systemInstruction };
      },
    )
    // Router agent: quyết định dùng tools nào (đặc biệt là knowledge_search), không trả lời người dùng.
    .addNode('router_step', async (state: typeof ChatGraphState.State) => {
      const nextTurn = state.turn + 1;
      const provider = this.llmFactory.getProvider(state.chatbot.llm_model);

      const messages: LLMMessage[] = state.geminiMessages.map((msg) => ({
        role: msg.role as any,
        content:
          msg.content || (msg as any).parts?.[0]?.text,
        functionCall:
          msg.functionCall || (msg as any).parts?.[0]?.functionCall,
        functionResponse:
          msg.functionResponse || (msg as any).parts?.[0]?.functionResponse
            ? {
                name:
                  msg.functionResponse?.name ??
                  (msg as any).parts[0].functionResponse.name,
                response:
                  msg.functionResponse?.response ??
                  (msg as any).parts[0].functionResponse.response,
              }
            : undefined,
      }));

      const routerSystemInstruction =
        (state.systemInstruction || '') +
        '\n\n[ROLE: TOOL ROUTER]\n' +
        'Bạn là Router Agent. Nhiệm vụ của bạn là phân tích câu hỏi hiện tại và ngữ cảnh hội thoại, ' +
        'sau đó QUYẾT ĐỊNH NÊN GỌI NHỮNG TOOL NÀO (có thể là 0, 1 hoặc N tools khác nhau) VÀ THAM SỐ CỤ THỂ CHO TỪNG TOOL, ' +
        'đặc biệt là `knowledge_search` cho các câu hỏi cần tra cứu tài liệu/knowledge. ' +
        'KHÔNG được trả lời nội dung cuối cùng cho người dùng ở bước này, chỉ nên tạo các function call phù hợp. ' +
        'Nếu thực sự không cần tools (câu hỏi quá đơn giản, chỉ cần trả lời trực tiếp), bạn có thể không tạo function call nào.';

      const response = await provider.chat(state.chatbot.llm_model, messages, {
        temperature: state.chatbot.temperature,
        maxTokens: state.chatbot.max_tokens,
        systemInstruction: routerSystemInstruction,
        tools: state.tools as any,
      });

      // Billing cho router agent
      if (response.usage && state.workspaceId) {
        try {
          await this.billingService.chargeUsage(
            state.workspaceId,
            state.chatbot.llm_provider,
            state.chatbot.llm_model,
            {
              input_tokens: response.usage.input_tokens,
              output_tokens: response.usage.output_tokens,
            },
            {
              conversationId: state.conversationId,
              chatbotId: state.chatbotId,
              phase: 'router',
            },
            state.userId,
          );
        } catch (err) {
          this.logger.error(
            `Failed to charge usage (router) for workspace ${state.workspaceId}:`,
            err as any,
          );
        }
      }

      // Lưu token usage để trả về cuối turn
      const tokenUpdate =
        response.usage != null
          ? {
              totalInputTokens: response.usage.input_tokens ?? 0,
              totalOutputTokens: response.usage.output_tokens ?? 0,
            }
          : {};

      // Router chỉ quan tâm tới function calls (nếu có)
      if (response.functionCalls && response.functionCalls.length > 0) {
        const calls = response.functionCalls;

        const callMsgs: any[] = calls.map((call) => ({
          role: 'assistant',
          functionCall: { name: call.name, args: call.args },
        }));

        return {
          turn: nextTurn,
          functionCalls: calls as any,
          geminiMessages: callMsgs as any,
          ...tokenUpdate,
        };
      }

      // Không có tools nào cần gọi -> chuyển sang Answer Agent
      return {
        turn: nextTurn,
        functionCalls: null,
        ...tokenUpdate,
      };
    })
    // Answer agent: tổng hợp kết quả từ tools (nếu có) và trả lời người dùng. Không được gọi thêm tools.
    .addNode('answer_step', async (state: typeof ChatGraphState.State) => {
      const nextTurn = state.turn + 1;
      const provider = this.llmFactory.getProvider(state.chatbot.llm_model);

      const messages: LLMMessage[] = state.geminiMessages.map((msg) => ({
        role: msg.role as any,
        content:
          msg.content || (msg as any).parts?.[0]?.text,
        functionCall:
          msg.functionCall || (msg as any).parts?.[0]?.functionCall,
        functionResponse:
          msg.functionResponse || (msg as any).parts?.[0]?.functionResponse
            ? {
                name:
                  msg.functionResponse?.name ??
                  (msg as any).parts[0].functionResponse.name,
                response:
                  msg.functionResponse?.response ??
                  (msg as any).parts[0].functionResponse.response,
              }
            : undefined,
      }));

      const answerSystemInstruction =
        (state.systemInstruction || '') +
        '\n\n[ROLE: ANSWER AGENT]\n' +
        'Bạn là Answer Agent. Nhiệm vụ của bạn là đọc toàn bộ ngữ cảnh hội thoại và kết quả từ các tools (function responses) ' +
        'đã được Router Agent gọi trước đó, sau đó soạn câu trả lời cuối cùng, rõ ràng, cô đọng và hữu ích cho người dùng. ' +
        'Ở bước này, bạn KHÔNG ĐƯỢC gọi thêm tools mới; hãy chỉ sử dụng các thông tin đã có trong messages hiện tại.';

      const response = await provider.chat(state.chatbot.llm_model, messages, {
        temperature: state.chatbot.temperature,
        maxTokens: state.chatbot.max_tokens,
        systemInstruction: answerSystemInstruction,
        // Không truyền tools vào Answer Agent để tránh việc gọi thêm tools vòng 2
      });

      // Billing cho answer agent
      if (response.usage && state.workspaceId) {
        try {
          await this.billingService.chargeUsage(
            state.workspaceId,
            state.chatbot.llm_provider,
            state.chatbot.llm_model,
            {
              input_tokens: response.usage.input_tokens,
              output_tokens: response.usage.output_tokens,
            },
            {
              conversationId: state.conversationId,
              chatbotId: state.chatbotId,
              phase: 'answer',
            },
            state.userId,
          );
        } catch (err) {
          this.logger.error(
            `Failed to charge usage (answer) for workspace ${state.workspaceId}:`,
            err as any,
          );
        }
      }

      const tokenUpdate =
        response.usage != null
          ? {
              totalInputTokens: response.usage.input_tokens ?? 0,
              totalOutputTokens: response.usage.output_tokens ?? 0,
            }
          : {};

      if (response.text) {
        return {
          turn: nextTurn,
          functionCalls: null,
          finalResponse: response.text,
          ...tokenUpdate,
        };
      }

      return {
        turn: nextTurn,
        functionCalls: null,
        ...tokenUpdate,
      };
    })
    .addNode('execute_tools', async (state: typeof ChatGraphState.State) => {
      const calls = state.functionCalls ?? [];
      if (calls.length === 0) return { functionCalls: null };

      const execOne = async (call: GeminiFunctionCall) => {
        const ctx = {
          workspaceId: state.workspaceId,
          userId: state.userId,
          sessionId: state.conversationId,
          chatbotId: state.chatbotId,
        };

        try {
          return await this.toolExecutorService.execute(call.name, call.args, ctx);
        } catch (err: any) {
          // Retry once (simple policy)
          try {
            return await this.toolExecutorService.execute(call.name, call.args, ctx);
          } catch (err2: any) {
            return {
              error: err2?.message ?? String(err2),
            };
          }
        }
      };

      // Execute in parallel for speed
      const results = await Promise.all(calls.map(execOne));
      
      this.logger.log(`Tool results: ${JSON.stringify(results)}`);

      // Collect files from results
      const files: any[] = [];
      results.forEach((res) => {
        if (res && res.url && (res.filename || res.path)) {
           this.logger.log(`Found file in result: ${JSON.stringify(res)}`);
           // Helper to detect type
           const isImage = (filename: string, mime?: string) => {
             if (mime && mime.startsWith('image/')) return true;
             if (filename && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) return true;
             return false;
           };

           const filename = res.filename || 'download';
           const type = isImage(filename, res.mime_type) ? 'image' : 'file';

           files.push({
             type,
             url: res.url,
             filename,
             size: res.size,
             mime_type: res.mime_type
           });
        }
      });
      
      this.logger.log(`Extracted files state update: ${JSON.stringify(files)}`);

      const fnResponses: GeminiMessage[] = calls.map((call, idx) => ({
        role: 'function',
        functionResponse: {
          name: call.name,
          response: results[idx],
        },
      }));

      const toolsUsedLog = calls.map((call, idx) => ({
        tool_name: call.name,
        args: call.args ?? {},
        result: results[idx],
      }));

      // Card: 1) result.cards, 2) mapper theo tool name, 3) generic chỉ khi action có card_config (plugin đánh dấu)
      const cardConfigByCall = new Map<string, { enabled?: boolean; list_path?: string; field_mapping?: Record<string, string> }>();
      for (const call of calls) {
        const sep = call.name.indexOf('__');
        if (sep > 0 && sep < call.name.length - 1) {
          const toolName = call.name.slice(0, sep);
          const actionName = call.name.slice(sep + 2);
          const config = await this.toolRegistryService.getCardConfig(toolName, actionName);
          if (config) cardConfigByCall.set(call.name, config);
        }
      }
      const cards = buildCardsFromToolResults(
        calls,
        results,
        { shopFrontendUrl: this.configService?.get<string>('SHOP_FRONTEND_URL') },
        { cardConfigByCall },
      );

      return {
        functionCalls: null,
        geminiMessages: fnResponses,
        files: files,
        cards,
        toolRunCount: state.toolRunCount + 1,
        toolsUsedLog,
      };
    })
    .addNode('finalize', async (state: typeof ChatGraphState.State) => {
      if (state.finalResponse && state.finalResponse.trim()) {
        return {};
      }

      return {
        finalResponse:
          state.chatbot.fallback_message ??
          'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.',
      };
    })
    .addEdge(START, 'prepare_tools')
    .addEdge('prepare_tools', 'prepare_history')
    .addEdge('prepare_history', 'prepare_knowledge')
    .addEdge('prepare_knowledge', 'router_step')
    .addConditionalEdges(
      'router_step',
      (state: typeof ChatGraphState.State) => {
        if (state.turn >= state.maxTurns) return 'finalize';
        if (state.functionCalls && state.functionCalls.length > 0)
          return 'execute_tools';
        return 'answer_step';
      },
      {
        execute_tools: 'execute_tools',
        answer_step: 'answer_step',
        finalize: 'finalize',
      },
    )
    // Sau khi chạy tools:
    // - Nếu đây là lần chạy tools đầu tiên -> quay lại router_step để router có thể quyết định gọi lại tools lần 2 nếu cần.
    // - Nếu đã chạy tools >= 1 lần -> chuyển sang answer_step để trả lời người dùng.
    .addConditionalEdges(
      'execute_tools',
      (state: typeof ChatGraphState.State) => {
        if (state.toolRunCount <= 0) return 'router_step';
        return 'answer_step';
      },
      {
        router_step: 'router_step',
        answer_step: 'answer_step',
      },
    )
    .addEdge('answer_step', 'finalize')
    .addEdge('finalize', END)
    .compile();

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly llmFactory: LLMFactoryService,
    private readonly ragService: RagService,
    private readonly knowledgeService: KnowledgeService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly toolExecutorService: ToolExecutorService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
  ) {}

  async runChatTurn(params: {
    workspaceId: string;
    chatbotId: string;
    userId: string;
    conversationId: string;
    userMessage: string;
    chatbot: Chatbot;
    /** Content extracted from attached images by plugin (e.g. OCR); images are not sent to the main model */
    extractedImageContent?: string;
  }): Promise<{
    response: string;
    turns: number;
    files: any[];
    cards: any[];
    tokenUsage?: { input_tokens: number; output_tokens: number };
    toolsUsed: { tool_name: string; args: Record<string, any>; result: any }[];
  }> {
    const result = await this.graph.invoke({
      ...params,
      extractedImageContent: params.extractedImageContent ?? '',
      systemInstruction: '',
      geminiMessages: [],
      tools: [],
      functionCalls: null,
      finalResponse: '',
      turn: 0,
      maxTurns: 5,
      files: [],
      cards: [],
      toolRunCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolsUsedLog: [],
    });

    const tokenUsage =
      (result.totalInputTokens ?? 0) > 0 || (result.totalOutputTokens ?? 0) > 0
        ? {
            input_tokens: result.totalInputTokens ?? 0,
            output_tokens: result.totalOutputTokens ?? 0,
          }
        : undefined;

    return {
      response: result.finalResponse,
      turns: result.turn,
      files: result.files ?? [],
      cards: result.cards ?? [],
      tokenUsage,
      toolsUsed: result.toolsUsedLog ?? [],
    };
  }

  private buildSystemInstruction(chatbot: Chatbot): string {
    const parts: string[] = [];

    if (chatbot.personality) {
      parts.push(chatbot.personality);
    }

    parts.push(`Bạn đang trả lời bằng ngôn ngữ: ${chatbot.language}`);

    if (chatbot.greeting_message) {
      parts.push(`Tin nhắn chào: "${chatbot.greeting_message}"`);
    }
    parts.push(
      'Hãy trả lời một cách ngắn gọn, rõ ràng và hữu ích. Nếu không chắc chắn, hãy thừa nhận và đề xuất cách khác.',
    );
    parts.push(
     'Tuyệt đối không hỏi lại người dùng chỉ sử dụng thông tin đã có trong tin nhắn trước đó',
    );
    parts.push(
      'HÃY TẬN DỤNG TỐI ĐA các công cụ (tools) đã được khai báo, chủ động sử dụng tất cả các tools phù hợp mà không cần hỏi lại người dùng. Sử dụng tool là điều được ưu tiên hơn trả lời chung chung hoặc yêu cầu người dùng lặp lại. '
    );

    // Hướng dẫn riêng cho trường hợp có ảnh đính kèm đã được OCR trước ở backend
    // (backend sẽ chèn thêm đoạn: "[Content from attached image(s)]:" + nội dung văn bản trích xuất)
    parts.push(
      'Nếu trong tin nhắn của người dùng có phần "[Content from attached image(s)]", hãy coi đó là văn bản đã được trích xuất từ ảnh đính kèm và sử dụng trực tiếp để trả lời. ' +
        'Trong trường hợp này, KHÔNG được yêu cầu người dùng cung cấp URL của ảnh nữa và không cần gọi thêm công cụ OCR để đọc ảnh.',
    );

    return parts.join('\n');
  }
}
