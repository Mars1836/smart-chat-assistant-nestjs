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

  /** Cards chung (product / article / link) từ tool để FE render card có ảnh + link */
  cards: Annotation<any[]>({
    reducer: (_left: any[], right: any[]) => (Array.isArray(right) ? right : []),
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
        const knowledgeIds =
          await this.knowledgeService.getEnabledKnowledgeIdsForChatbot(
            state.chatbotId,
          );

        const contexts =
          knowledgeIds.length > 0
            ? await this.ragService.searchForChatbot(
                state.userMessage,
                state.chatbotId,
                knowledgeIds,
                3,
                state.chatbot.confidence_threshold,
              )
            : []; // If no knowledge linked, skip RAG (do not fallback to workspace search)

        const contextString =
          contexts.length > 0
            ? `\n\n[Context Information]:\n${contexts.join('\n\n')}\n\n[End Context]`
            : '';

        const systemInstruction =
          this.buildSystemInstruction(state.chatbot) + contextString;

        return { systemInstruction };
      },
    )
    .addNode('llm_step', async (state: typeof ChatGraphState.State) => {
      const nextTurn = state.turn + 1;
      const provider = this.llmFactory.getProvider(state.chatbot.llm_model);

      const messages: LLMMessage[] = state.geminiMessages.map(msg => ({
          role: msg.role as any,
          content: msg.content || (msg as any).parts?.[0]?.text, // Handle legacy parts if present or content directly
          functionCall: msg.functionCall || (msg as any).parts?.[0]?.functionCall,
          functionResponse: msg.functionResponse || (msg as any).parts?.[0]?.functionResponse 
            ? {
                name: msg.functionResponse?.name ?? (msg as any).parts[0].functionResponse.name,
                response: msg.functionResponse?.response ?? (msg as any).parts[0].functionResponse.response
              } 
            : undefined
      }));

      const response = await provider.chat(
        state.chatbot.llm_model,
        messages,
        {
          temperature: state.chatbot.temperature,
          maxTokens: state.chatbot.max_tokens,
          systemInstruction: state.systemInstruction,
          tools: state.tools as any,
        },
      );

      // If provider requests tool calls
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
        };
      }

      if (response.text) {
        return {
          turn: nextTurn,
          functionCalls: null,
          finalResponse: response.text,
        };
      }

      return {
        turn: nextTurn,
        functionCalls: null,
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
    .addEdge('prepare_knowledge', 'llm_step')
    .addConditionalEdges(
      'llm_step',
      (state: typeof ChatGraphState.State) => {
        if (state.turn >= state.maxTurns) return 'finalize';
        if (state.functionCalls && state.functionCalls.length > 0) return 'execute_tools';
        return 'finalize';
      },
      {
        execute_tools: 'execute_tools',
        finalize: 'finalize',
      },
    )
    .addEdge('execute_tools', 'llm_step')
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
  }): Promise<{ response: string; turns: number; files: any[]; cards: any[] }> {
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
    });

    return {
      response: result.finalResponse,
      turns: result.turn,
      files: result.files ?? [],
      cards: result.cards ?? [],
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

    // Hướng dẫn riêng cho trường hợp có ảnh đính kèm đã được OCR trước ở backend
    // (backend sẽ chèn thêm đoạn: "[Content from attached image(s)]:" + nội dung văn bản trích xuất)
    parts.push(
      'Nếu trong tin nhắn của người dùng có phần "[Content from attached image(s)]", hãy coi đó là văn bản đã được trích xuất từ ảnh đính kèm và sử dụng trực tiếp để trả lời. ' +
        'Trong trường hợp này, KHÔNG được yêu cầu người dùng cung cấp URL của ảnh nữa và không cần gọi thêm công cụ OCR để đọc ảnh.',
    );

    return parts.join('\n');
  }
}
