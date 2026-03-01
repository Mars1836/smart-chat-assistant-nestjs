import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Chatbot } from './entities/chatbot.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { MessageAttachment } from '../messages/entities/message-attachment.entity';
import { CreateChatbotDto, UpdateChatbotDto, ChatDto } from './dto';
import { GeminiProvider } from '../../common/providers/gemini.provider';
import { RagService } from '../rag/rag.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import { ChatOrchestratorService } from './chat-orchestrator.service';

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
    @InjectRepository(MessageAttachment)
    private readonly attachmentRepo: Repository<MessageAttachment>,
    private readonly aiStudioService: GeminiProvider,
    private readonly ragService: RagService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly toolExecutorService: ToolExecutorService,
    private readonly chatOrchestrator: ChatOrchestratorService,
    private readonly configService: ConfigService,
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
    files: any[];
    uploaded_images: any[];
    cards: any[];
    processingTime: number;
    token_usage: { input_tokens: number; output_tokens: number };
    tools_used: { tool_name: string; args: Record<string, any>; result: any }[];
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
    const savedUserMessage = await this.messageRepo.save(userMessage);

    // Save uploaded images as attachments
    const uploadedImages: any[] = [];
    if (chatDto.images && chatDto.images.length > 0) {
      const savedAttachments = await this.saveUploadedImages(
        workspaceId,
        savedUserMessage.id,
        chatDto.images,
      );
      uploadedImages.push(...savedAttachments);
    }

    try {
      let extractedImageContent: string | undefined;
      if (uploadedImages.length > 0) {
        const appUrl =
          this.configService.get<string>('APP_URL') ?? 'http://localhost:4000';
        const imageUrls = uploadedImages.map(
          (att: { url: string }) =>
            `${appUrl.replace(/\/$/, '')}${att.url.startsWith('/') ? att.url : '/' + att.url}`,
        );
        const ctx = {
          workspaceId,
          userId,
          sessionId: chatDto.conversation_id,
          chatbotId,
        };
        const texts: string[] = [];
        for (const url of imageUrls) {
          try {
            const result = await this.toolExecutorService.execute(
              'ocr',
              { imageUrl: url },
              ctx,
            );
            if (result?.text) texts.push(String(result.text).trim());
          } catch (err) {
            this.logger.warn(`OCR failed for image ${url}:`, err);
          }
        }
        if (texts.length > 0) {
          extractedImageContent = texts.join('\n\n---\n\n');
        }
      }

      const { response: finalResponseText, files, cards, tokenUsage, toolsUsed } =
        await this.chatOrchestrator.runChatTurn({
          workspaceId,
          chatbotId,
          userId,
          conversationId: chatDto.conversation_id,
          userMessage: chatDto.message,
          chatbot,
          extractedImageContent,
        });

      // Lưu tin nhắn bot vào database (kèm token usage và tools đã dùng)
      const botMessage = this.messageRepo.create({
        conversation: { id: chatDto.conversation_id } as Conversation,
        sender_type: 'bot',
        sender: null,
        content: finalResponseText,
        token_usage: tokenUsage ?? null,
        tools_used: toolsUsed?.length ? toolsUsed : null,
      });
      const savedBotMessage = await this.messageRepo.save(botMessage);

      // Save attachments if any
      const responseFiles = files || [];
      if (responseFiles.length > 0) {
         // Note: We need MessageAttachment repo here, assuming it's cascaded or we inject it
         // Since we added cascade: true to Message entity, we can just assign and save
         savedBotMessage.attachments = responseFiles.map((f: any) => ({
           type: f.type,
           url: f.url,
           filename: f.filename,
           size: f.size,
           mime_type: f.mime_type
         })) as any;
         await this.messageRepo.save(savedBotMessage);
      }

      const processingTime = Date.now() - startTime;

      this.logger.log(
        `Chat response generated in ${processingTime}ms for workspace ${workspaceId}`,
      );

      return {
        conversation_id: chatDto.conversation_id,
        response: finalResponseText,
        model: chatbot.llm_model,
        files: responseFiles,
        uploaded_images: uploadedImages,
        cards: cards || [],
        processingTime,
        token_usage: tokenUsage ?? { input_tokens: 0, output_tokens: 0 },
        tools_used: toolsUsed ?? [],
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
        files: [],
        uploaded_images: uploadedImages,
        cards: [],
        processingTime: Date.now() - startTime,
        token_usage: { input_tokens: 0, output_tokens: 0 },
        tools_used: [],
      };
    }
  }

  /**
   * Save uploaded images to disk and database
   */
  private async saveUploadedImages(
    workspaceId: string,
    messageId: string,
    files: Express.Multer.File[],
  ): Promise<any[]> {
    const savedAttachments: any[] = [];

    // Create upload directory
    const uploadsDir = path.join(
      process.cwd(),
      'uploads',
      'chat-images',
      workspaceId,
    );
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    for (const file of files) {
      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const uniqueName = `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Create attachment record
      const attachment = this.attachmentRepo.create({
        message_id: messageId,
        type: 'image',
        url: `/uploads/chat-images/${workspaceId}/${uniqueName}`,
        filename: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
      });

      const savedAttachment = await this.attachmentRepo.save(attachment);

      savedAttachments.push({
        id: savedAttachment.id,
        url: savedAttachment.url,
        filename: savedAttachment.filename,
        mime_type: savedAttachment.mime_type,
        size: savedAttachment.size,
      });

      this.logger.log(`Saved chat image: ${savedAttachment.url}`);
    }

    return savedAttachments;
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
