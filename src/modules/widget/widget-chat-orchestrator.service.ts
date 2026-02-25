import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { Message } from '../messages/entities/message.entity';
import { RagService } from '../rag/rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { LLMMessage } from '../../common/interfaces/llm-provider.interface';
import { BillingService } from '../billing/billing.service';

type GeminiMessage = {
  role: 'user' | 'assistant' | 'function';
  content?: string;
  functionResponse?: { name: string; response: any };
  functionCall?: { name: string; args: any };
};

type GeminiFunctionCall = { name: string; args: any };

const WidgetChatGraphState = Annotation.Root({
  workspaceId: Annotation<string>,
  chatbotId: Annotation<string>,
  conversationId: Annotation<string>,
  visitorId: Annotation<string>,
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
});

@Injectable()
export class WidgetChatOrchestratorService {
  private readonly logger = new Logger(WidgetChatOrchestratorService.name);

  private readonly graph = new StateGraph(WidgetChatGraphState)
    .addNode('prepare_tools', this.prepareTools.bind(this))
    .addNode('prepare_history', this.prepareHistory.bind(this))
    .addNode('prepare_knowledge', this.prepareKnowledge.bind(this))
    .addNode('llm_step', this.llmStep.bind(this))
    .addNode('execute_tools', this.executeTools.bind(this))
    .addNode('finalize', this.finalize.bind(this))
    .addEdge(START, 'prepare_tools')
    .addEdge('prepare_tools', 'prepare_history')
    .addEdge('prepare_history', 'prepare_knowledge')
    .addEdge('prepare_knowledge', 'llm_step')
    .addConditionalEdges(
      'llm_step',
      (state: typeof WidgetChatGraphState.State) => {
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
    private readonly billingService: BillingService,
  ) {}

  /**
   * Node: Prepare tools for chatbot
   */
  protected async prepareTools(state: typeof WidgetChatGraphState.State) {
    const tools = await this.toolRegistryService.formatForLLMWithPermissions(
      state.chatbotId,
    );
    return { tools };
  }

  /**
   * Node: Prepare message history from conversation
   */
  protected async prepareHistory(state: typeof WidgetChatGraphState.State) {
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

    // Ensure last message is the current user message
    const last = mapped.at(-1);
    if (!last || last.role !== 'user' || last.content !== state.userMessage) {
      mapped.push({ role: 'user', content: state.userMessage });
    }

    return { geminiMessages: mapped };
  }

  /**
   * Node: RAG search and build system instruction
   */
  protected async prepareKnowledge(state: typeof WidgetChatGraphState.State) {
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
        : [];

    const contextString =
      contexts.length > 0
        ? `\n\n[Context Information]:\n${contexts.join('\n\n')}\n\n[End Context]`
        : '';

    const systemInstruction =
      this.buildSystemInstruction(state.chatbot) + contextString;

    return { systemInstruction };
  }

  /**
   * Node: Call LLM with messages and tools
   */
  protected async llmStep(state: typeof WidgetChatGraphState.State) {
    const nextTurn = state.turn + 1;
    const provider = this.llmFactory.getProvider(state.chatbot.llm_model);

    const messages: LLMMessage[] = state.geminiMessages.map((msg) => ({
      role: msg.role as any,
      content: msg.content || (msg as any).parts?.[0]?.text,
      functionCall: msg.functionCall || (msg as any).parts?.[0]?.functionCall,
      functionResponse: msg.functionResponse || (msg as any).parts?.[0]?.functionResponse
        ? {
            name: msg.functionResponse?.name ?? (msg as any).parts[0].functionResponse.name,
            response: msg.functionResponse?.response ?? (msg as any).parts[0].functionResponse.response,
          }
        : undefined,
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

    // Billing: charge usage per workspace if usage info is available
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
            visitorId: state.visitorId,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to charge usage for workspace ${state.workspaceId} (widget):`,
          err as any,
        );
      }
    }

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
  }

  /**
   * Node: Execute tool calls
   */
  protected async executeTools(state: typeof WidgetChatGraphState.State) {
    const calls = state.functionCalls ?? [];
    if (calls.length === 0) return { functionCalls: null };

    const execOne = async (call: GeminiFunctionCall) => {
      const ctx = {
        workspaceId: state.workspaceId,
        userId: 'widget', // Widget is anonymous
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
          mime_type: res.mime_type,
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

    return {
      functionCalls: null,
      geminiMessages: fnResponses,
      files: files,
    };
  }

  /**
   * Node: Finalize response
   */
  protected async finalize(state: typeof WidgetChatGraphState.State) {
    if (state.finalResponse && state.finalResponse.trim()) {
      return {};
    }

    return {
      finalResponse:
        state.chatbot.fallback_message ??
        'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.',
    };
  }

  /**
   * Main entry point for widget chat turn
   */
  async runWidgetChatTurn(params: {
    workspaceId: string;
    chatbotId: string;
    conversationId: string;
    visitorId: string;
    userMessage: string;
    chatbot: Chatbot;
  }): Promise<{ response: string; turns: number; files: any[] }> {
    const result = await this.graph.invoke({
      ...params,
      systemInstruction: '',
      geminiMessages: [],
      tools: [],
      functionCalls: null,
      finalResponse: '',
      turn: 0,
      maxTurns: 5,
      files: [],
    });

    return {
      response: result.finalResponse,
      turns: result.turn,
      files: result.files ?? [],
    };
  }

  /**
   * Build system instruction from chatbot config
   */
  protected buildSystemInstruction(chatbot: Chatbot): string {
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

    return parts.join('\n');
  }
}
