import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chatbot } from './entities/chatbot.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { CreateChatbotDto, UpdateChatbotDto, ChatDto } from './dto';
import { AIStudioService } from '../../common/providers';
import { RagService } from '../rag/rag.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';

@Injectable()
export class ChatbotsService extends BaseService<Chatbot> {
  private readonly logger = new Logger(ChatbotsService.name);

  constructor(
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly aiStudioService: AIStudioService,
    private readonly ragService: RagService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly toolExecutorService: ToolExecutorService,
  ) {
    super();
  }

  protected getRepository(): Repository<Chatbot> {
    return this.chatbotRepo;
  }

  /**
   * Tạo chatbot mới cho workspace
   */
  async create(
    workspaceId: string,
    userId: string,
    createDto: CreateChatbotDto,
  ): Promise<Chatbot> {
    // Kiểm tra workspace tồn tại
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Tạo chatbot
    const chatbot = this.chatbotRepo.create({
      workspace_id: workspaceId,
      name: createDto.name,
      language: createDto.language ?? 'vi',
      personality: createDto.personality ?? null,
      greeting_message:
        createDto.greeting_message ?? 'Xin chào! Tôi có thể giúp gì cho bạn?',
      fallback_message:
        createDto.fallback_message ?? 'Xin lỗi, tôi chưa hiểu câu hỏi của bạn.',
      confidence_threshold: createDto.confidence_threshold ?? 0.7,
      max_context_turns: createDto.max_context_turns ?? 5,
      enable_learning: createDto.enable_learning ?? true,
      llm_provider: createDto.llm_provider ?? 'google-ai-studio',
      llm_model: createDto.llm_model ?? 'gemini-2.0-flash-lite',
      temperature: createDto.temperature ?? 0.7,
      max_tokens: createDto.max_tokens ?? 1000,
      enabled: true,
    });

    return await this.chatbotRepo.save(chatbot);
  }

  /**
   * Lấy tất cả chatbots của workspace (có phân trang)
   */
  async findAllByWorkspace(
    workspaceId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Chatbot>> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (!pagination.sortBy) {
      pagination.sortBy = 'created_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where: { workspace_id: workspaceId },
    });
  }

  /**
   * Lấy 1 chatbot theo ID
   */
  async findOne(workspaceId: string, chatbotId: string): Promise<Chatbot> {
    const chatbot = await this.chatbotRepo.findOne({
      where: { id: chatbotId, workspace_id: workspaceId },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    return chatbot;
  }

  /**
   * Cập nhật chatbot
   */
  async update(
    workspaceId: string,
    chatbotId: string,
    userId: string,
    updateDto: UpdateChatbotDto,
  ): Promise<Chatbot> {
    const chatbot = await this.findOne(workspaceId, chatbotId);

    Object.assign(chatbot, updateDto);
    return await this.chatbotRepo.save(chatbot);
  }

  /**
   * Xóa chatbot
   */
  async remove(
    workspaceId: string,
    chatbotId: string,
    userId: string,
  ): Promise<void> {
    const chatbot = await this.findOne(workspaceId, chatbotId);
    await this.chatbotRepo.remove(chatbot);
  }

  /**
   * Chat với chatbot
   */
  async chat(
    workspaceId: string,
    chatbotId: string,
    userId: string,
    chatDto: ChatDto,
  ): Promise<{
    conversation_id: string;
    response: string;
    model: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    // Lấy chatbot config
    const chatbot = await this.findOne(workspaceId, chatbotId);

    if (!chatbot.enabled) {
      throw new ForbiddenException('Chatbot is disabled for this workspace');
    }

    // Kiểm tra conversation tồn tại và thuộc chatbot này
    const conversation = await this.conversationRepo.findOne({
      where: { id: chatDto.conversation_id, chatbot_id: chatbotId },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found or does not belong to this chatbot',
      );
    }

    // Lưu tin nhắn user vào database
    const userMessage = this.messageRepo.create({
      conversation: { id: chatDto.conversation_id } as Conversation,
      sender_type: 'user',
      sender: { id: userId } as any,
      content: chatDto.message,
    });
    await this.messageRepo.save(userMessage);

    try {
      // 1. Prepare Tools
      const tools = await this.toolRegistryService.formatForLLMWithPermissions(
        chatbotId,
      );
      this.logger.log(`[Tools Debug] Tools sent to LLM: ${JSON.stringify(tools)}`);

      // 2. Prepare Context (History & RAG)
      // Retrieve recent messages for context
      const history = await this.messageRepo.find({
        where: { conversation: { id: chatDto.conversation_id } },
        order: { created_at: 'DESC' },
        take: chatbot.max_context_turns * 2, // 2 message per turn (user + bot)
      });
      history.reverse(); // Newest last

      // RAG Retrieval
      const relevantContexts = await this.ragService.search(
        chatDto.message,
        { workspaceId },
        3,
      );
      const contextString =
        relevantContexts.length > 0
          ? `\n\n[Context Information]:\n${relevantContexts.join('\n\n')}\n\n[End Context]`
          : '';

      const systemInstruction =
        this.buildSystemInstruction(chatbot) + contextString;

      // 3. Prepare Initial Messages
      const geminiMessages: Array<{
        role: 'user' | 'assistant' | 'function';
        content?: string;
        functionResponse?: { name: string; response: any };
        functionCall?: { name: string; args: any };
      }> = history.map((msg) => ({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Ensure last message is current user message (though we just saved it, history fetch might have missed it if race condition or transaction)
      // Since we just saved userMessage, we can rely on history fetch including it if atomic,
      // but to be safe and simple, let's just append current message if history doesn't feature it last.
      // Actually, since we use `history` for the API calls, better to reconstruct specifically for the turn.
      // Let's rely on standard flow:
      // Messages to send = History (excluding current) + Current User Message
      // Current User Message is already in DB. 'history' array contains it if we fetched after save.

      // 4. Main Execution Loop (Handle Function Calls)
      let finalResponseText = '';
      let maxTurns = 5; // Prevent infinite loops
      let currentTurn = 0;

      while (currentTurn < maxTurns) {
        currentTurn++;

        const response = await this.aiStudioService.chat(
          chatbot.llm_model,
          geminiMessages,
          {
            temperature: chatbot.temperature,
            maxTokens: chatbot.max_tokens,
            systemInstruction,
            tools: tools as any, // Cast to any to avoid strict type mismatch if needed
          },
        );

        // Handle Function Calls
        if (response.functionCalls && response.functionCalls.length > 0) {
          // Append assistant function call to history (for next iteration)
          // Note: Gemini expects function call to be part of history for function response to make sense
          // We add the first function call (Gemini usually does one step at a time or parallel)
          // Our chat interface supports multiple, but let's handle them.
          
          for (const call of response.functionCalls) {
             geminiMessages.push({
              role: 'assistant',
              functionCall: { name: call.name, args: call.args },
            });

            this.logger.log(`Executing tool: ${call.name}`);
            
            // Execute Tool
            let functionResult: any;
            try {
              functionResult = await this.toolExecutorService.execute(
                call.name,
                call.args,
                {
                    workspaceId,
                    userId,
                    sessionId: chatDto.conversation_id,
                    chatbotId, // Added missing required property
                }
              );
            } catch (err: any) {
              functionResult = { error: err.message };
            }

            this.logger.debug(`Tool result for ${call.name}: ${JSON.stringify(functionResult)}`);

            // Append Function Response
            geminiMessages.push({
              role: 'function',
              functionResponse: {
                name: call.name,
                response: functionResult,
              },
            });
          }
          
          // Continue loop to let model interpret results
          continue;
        }

        // If text response, we are done
        if (response.text) {
          finalResponseText = response.text;
          break;
        }
        
        // If neither text nor function call (should be rare/error), break
        break;
      }
      
      if (!finalResponseText) {
          finalResponseText = "Tôi không thể xử lý yêu cầu này (No response generated).";
      }

      // Lưu tin nhắn bot vào database
      const botMessage = this.messageRepo.create({
        conversation: { id: chatDto.conversation_id } as Conversation,
        sender_type: 'bot',
        sender: null,
        content: finalResponseText,
      });
      await this.messageRepo.save(botMessage);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Chat response generated in ${processingTime}ms for workspace ${workspaceId}`,
      );

      return {
        conversation_id: chatDto.conversation_id,
        response: finalResponseText,
        model: chatbot.llm_model,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error in chat:', error);

      const fallbackResponse =
        chatbot.fallback_message ??
        'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.';

      // Lưu fallback response vào database
      const botMessage = this.messageRepo.create({
        conversation: { id: chatDto.conversation_id } as Conversation,
        sender_type: 'bot',
        sender: null,
        content: fallbackResponse,
      });
      await this.messageRepo.save(botMessage);

      return {
        conversation_id: chatDto.conversation_id,
        response: fallbackResponse,
        model: chatbot.llm_model,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build system instruction từ chatbot config
   */
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

    return parts.join('\n');
  }

  /**
   * Test AI connection
   */
  async testConnection(): Promise<boolean> {
    return await this.aiStudioService.testConnection();
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    return await this.aiStudioService.listModels();
  }
}
