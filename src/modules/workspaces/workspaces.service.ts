import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';

@Injectable()
export class WorkspacesService extends BaseService<Workspace> {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Chatbot)
    private readonly chatbotRepository: Repository<Chatbot>,
  ) {
    super();
  }

  protected getRepository(): Repository<Workspace> {
    return this.workspaceRepository;
  }

  async create(
    userId: string,
    createWorkspaceDto: CreateWorkspaceDto,
  ): Promise<Workspace> {
    // Create workspace
    // created_by_id sẽ được tự động thêm bởi BaseEntitySubscriber
    const workspace = this.workspaceRepository.create({
      ...createWorkspaceDto,
      owner_id: userId,
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Auto-create chatbot for this workspace
    // created_by_id sẽ được tự động thêm bởi BaseEntitySubscriber
    const chatbot = this.chatbotRepository.create({
      workspace_id: savedWorkspace.id,
      name: `${savedWorkspace.name} Bot`,
      language: 'vi',
      greeting_message: `Xin chào! Tôi là chatbot của ${savedWorkspace.name}. Tôi có thể giúp gì cho bạn?`,
      fallback_message:
        'Xin lỗi, tôi chưa hiểu yêu cầu của bạn. Bạn có thể nói rõ hơn được không?',
    });

    await this.chatbotRepository.save(chatbot);

    return savedWorkspace;
  }

  /**
   * Lấy danh sách workspaces của user (có phân trang)
   * Note: Không dùng findAll() từ base class vì cần userId parameter
   */
  async findAllByUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Workspace>> {
    // TODO: Also include workspaces where user is a member
    // For now, just return workspaces owned by user
    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'created_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      where: { owner_id: userId },
    });
  }

  // Alias để giữ backward compatibility
  async findAll(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Workspace>> {
    return this.findAllByUser(userId, pagination);
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    // Access control handled by PermissionsGuard

    return workspace;
  }

  async update(
    id: string,
    userId: string,
    updateWorkspaceDto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const workspace = await this.findOne(id, userId);

    // Only owner can update - Moved to PermissionsGuard

    Object.assign(workspace, updateWorkspaceDto);
    return this.workspaceRepository.save(workspace);
  }

  async remove(id: string, userId: string): Promise<void> {
    const workspace = await this.findOne(id, userId);

    // Only owner can delete - Moved to PermissionsGuard

    await this.workspaceRepository.remove(workspace);
  }

  async getChatbot(workspaceId: string, userId: string): Promise<Chatbot> {
    // Verify access to workspace
    await this.findOne(workspaceId, userId);

    const chatbot = await this.chatbotRepository.findOne({
      where: { workspace_id: workspaceId },
    });

    if (!chatbot) {
      throw new NotFoundException(
        `Chatbot not found for workspace ${workspaceId}`,
      );
    }

    return chatbot;
  }
}
