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
    // Kiểm tra workspace tồn tại và user là owner
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('Only workspace owner can create chatbot');
    }

    // TODO: Có thể thêm giới hạn số lượng chatbot theo plan
    // const count = await this.chatbotRepo.count({ where: { workspace_id: workspaceId } });
    // if (count >= MAX_CHATBOTS_PER_WORKSPACE) { throw error }

    // Tạo chatbot
    // created_by_id sẽ được tự động thêm bởi BaseEntitySubscriber
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
    // Kiểm tra user có quyền truy cập workspace
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // TODO: Check if user is member of workspace

    // Set default sort if not provided
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
    // Kiểm tra workspace
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // TODO: Check if user is member of workspace

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
    // Kiểm tra workspace owner
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('Only workspace owner can update chatbot');
    }

    const chatbot = await this.chatbotRepo.findOne({
      where: { id: chatbotId, workspace_id: workspaceId },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    // Update
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
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.owner_id !== userId) {
      throw new ForbiddenException('Only workspace owner can delete chatbot');
    }

    const chatbot = await this.chatbotRepo.findOne({
      where: { id: chatbotId, workspace_id: workspaceId },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

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
  ): Promise<{ conversation_id: string; response: string; model: string; processingTime: number }> {
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
      throw new NotFoundException('Conversation not found or does not belong to this chatbot');
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
      // Build system instruction
      const systemInstruction = this.buildSystemInstruction(chatbot);

      // Call AI Studio API
      const response = await this.aiStudioService.generateResponse(
        chatbot.llm_model,
        chatDto.message,
        {
          temperature: chatbot.temperature,
          maxTokens: chatbot.max_tokens,
          systemInstruction,
        },
      );

      // Lưu tin nhắn bot vào database
      const botMessage = this.messageRepo.create({
        conversation: { id: chatDto.conversation_id } as Conversation,
        sender_type: 'bot',
        sender: null,
        content: response,
      });
      await this.messageRepo.save(botMessage);

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Chat response generated in ${processingTime}ms for workspace ${workspaceId}`,
      );

      return {
        conversation_id: chatDto.conversation_id,
        response,
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
