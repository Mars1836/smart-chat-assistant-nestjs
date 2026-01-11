import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { CreateConversationDto, UpdateConversationDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { WorkspacePermissionsService } from '../workspace-permissions/workspace-permissions.service';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';

@Injectable()
export class ConversationsService extends BaseService<Conversation> {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Chatbot)
    private readonly chatbotRepository: Repository<Chatbot>,
    private readonly permissionsService: WorkspacePermissionsService,
  ) {
    super();
  }

  protected getRepository(): Repository<Conversation> {
    return this.conversationRepository;
  }

  /**
   * Tạo conversation mới
   */
  async create(
    userId: string,
    createConversationDto: CreateConversationDto,
  ): Promise<Conversation> {
    const workspaceId = createConversationDto.workspace_id;

    // Check member access (read access to workspace)
    // Any active member can start a conversation
    const canAccess = await this.permissionsService.checkPermission(
      workspaceId,
      userId,
      WORKSPACE_PERMISSIONS.CHATBOT_CHAT, // Need chat permission to start conversation
    );

    if (!canAccess) {
      throw new ForbiddenException(
        'You do not have permission to chat in this workspace',
      );
    }

    // Kiểm tra chatbot tồn tại và thuộc workspace
    const chatbot = await this.chatbotRepository.findOne({
      where: {
        id: createConversationDto.chatbot_id,
        workspace_id: workspaceId,
        enabled: true,
      },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found or disabled');
    }

    // Tạo conversation
    const conversation = this.conversationRepository.create({
      workspace_id: workspaceId,
      user_id: userId,
      chatbot_id: createConversationDto.chatbot_id,
      started_at: new Date(),
    });

    return await this.conversationRepository.save(conversation);
  }

  /**
   * Lấy danh sách conversations của workspace (có phân trang)
   */
  async findAllByWorkspace(
    workspaceId: string,
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Conversation>> {
    // Check if user is Owner/Admin using MEMBER_VIEW (or similar high-level permission)
    // Owners and Admins can view all member conversations
    const canViewAll = await this.permissionsService.checkPermission(
      workspaceId,
      userId,
      WORKSPACE_PERMISSIONS.MEMBER_UPDATE_ROLE, // Only Admin/Owner has this
    );

    // Default where clause
    const where: any = { workspace_id: workspaceId };

    // If not admin/owner, restrict to own conversations
    if (!canViewAll) {
      // Check basic access first
      const hasAccess = await this.permissionsService.checkPermission(
        workspaceId,
        userId,
        WORKSPACE_PERMISSIONS.CHATBOT_CHAT, // Basic member access
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this workspace conversations',
        );
      }
      where.user_id = userId;
    }

    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'started_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where,
      relations: ['user', 'chatbot'],
    });
  }

  /**
   * Lấy danh sách conversations của user (có phân trang)
   */
  async findAllByUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Conversation>> {
    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'started_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where: { user_id: userId },
      relations: ['workspace', 'chatbot'],
    });
  }

  /**
   * Lấy danh sách conversations của chatbot (có phân trang)
   */
  async findAllByChatbot(
    chatbotId: string,
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Conversation>> {
    // Kiểm tra chatbot tồn tại và user có quyền truy cập
    const chatbot = await this.chatbotRepository.findOne({
      where: { id: chatbotId },
      relations: ['workspace'],
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }
    console.log('userId', userId);
    console.log('chatbot.workspace.owner_id', chatbot.workspace.owner_id);
    // Kiểm tra quyền truy cập workspace
    if (chatbot.workspace.owner_id !== userId) {
      throw new ForbiddenException('You do not have access to this chatbot');
    }

    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'started_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where: { chatbot_id: chatbotId },
      relations: ['user', 'workspace'],
    });
  }

  /**
   * Lấy thông tin chi tiết conversation
   */
  async findOne(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['workspace', 'user', 'chatbot'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Kiểm tra quyền truy cập
    if (
      conversation.user_id !== userId &&
      conversation.workspace.owner_id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    return conversation;
  }

  /**
   * Cập nhật conversation
   */
  async update(
    conversationId: string,
    userId: string,
    updateConversationDto: UpdateConversationDto,
  ): Promise<Conversation> {
    const conversation = await this.findOne(conversationId, userId);

    // Chỉ user của conversation hoặc owner của workspace mới có thể cập nhật
    if (updateConversationDto.ended_at !== undefined) {
      conversation.ended_at = updateConversationDto.ended_at
        ? new Date(updateConversationDto.ended_at)
        : null;
    }

    return await this.conversationRepository.save(conversation);
  }

  /**
   * Xóa conversation
   */
  async remove(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.findOne(conversationId, userId);

    // Chỉ user của conversation hoặc owner của workspace mới có thể xóa
    await this.conversationRepository.remove(conversation);
  }
}
