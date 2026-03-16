import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import { WORKSPACE_ROLES } from '../../common/constants/permissions.constant';
import { WorkspaceStatsSummaryDto } from './dto';
import { WorkspaceEncryptionService } from './workspace-encryption.service';

@Injectable()
export class WorkspacesService extends BaseService<Workspace> {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Chatbot)
    private readonly chatbotRepository: Repository<Chatbot>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceRole)
    private readonly roleRepository: Repository<WorkspaceRole>,
    private readonly dataSource: DataSource,
    private readonly workspaceEncryptionService: WorkspaceEncryptionService,
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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create workspace
      const workspace = this.workspaceRepository.create({
        ...createWorkspaceDto,
        owner_id: userId,
      });
      const savedWorkspace = await queryRunner.manager.save(workspace);

      // 2. Auto-create chatbot
      const chatbot = this.chatbotRepository.create({
        workspace_id: savedWorkspace.id,
        name: `${savedWorkspace.name} Bot`,
        language: 'vi',
        greeting_message: `Xin chào! Tôi là chatbot của ${savedWorkspace.name}. Tôi có thể giúp gì cho bạn?`,
        fallback_message:
          'Xin lỗi, tôi chưa hiểu yêu cầu của bạn. Bạn có thể nói rõ hơn được không?',
      });
      await queryRunner.manager.save(chatbot);

      // 3. Add owner as member
      const ownerRole = await this.roleRepository.findOne({
        where: { name: WORKSPACE_ROLES.OWNER },
      });

      if (!ownerRole) {
        throw new InternalServerErrorException('Owner role not found in system');
      }

      const ownerMember = this.memberRepository.create({
        workspace_id: savedWorkspace.id,
        user_id: userId,
        workspace_role_id: ownerRole.id,
        is_active: true,
      });
      await queryRunner.manager.save(ownerMember);

      await queryRunner.commitTransaction();

      // 4. Tạo DEK cho workspace (sau commit; nếu VAULT_TOKEN không có thì bỏ qua)
      try {
        await this.workspaceEncryptionService.createDekForWorkspace(
          savedWorkspace.id,
        );
      } catch (dekErr) {
        // Workspace đã tạo; log lỗi DEK, không fail request. Seed có thể bù sau.
        this.logger.warn(
          `Failed to create DEK for workspace ${savedWorkspace.id}: ${dekErr}`,
        );
      }

      return savedWorkspace;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Lấy danh sách workspaces của user (có phân trang)
   * Bao gồm: workspaces mà user là owner HOẶC là member
   */
  async findAllByUser(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Workspace>> {
    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'created_at';
      pagination.sortOrder = 'DESC';
    }

    const { page = 1, limit = 10, sortBy, sortOrder = 'DESC' } = pagination;
    const skip = (page - 1) * limit;

    // Query builder to get workspaces where user is owner OR member
    const queryBuilder = this.workspaceRepository
      .createQueryBuilder('workspace')
      .leftJoin('workspace_members', 'member', 'member.workspace_id = workspace.id AND member.user_id = :userId AND member.is_active = true', { userId })
      .leftJoin('workspace_roles', 'role', 'role.id = member.workspace_role_id')
      .select([
        'workspace',
        'member.id',
        'member.workspace_role_id', 
        'role.name'
      ])
      .where('workspace.owner_id = :userId', { userId })
      .orWhere('member.user_id = :userId', { userId })
      .distinct(true)
      .orderBy(`workspace.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    const [workspaces, total] = await queryBuilder.getManyAndCount();

    // Map workspaces to include is_owner and user_role
    const data = workspaces.map((workspace: any) => {
      const isOwner = workspace.owner_id === userId;
      let userRole = isOwner ? 'Owner' : null;

      // If not owner, get role from member relationship
      if (!isOwner && workspace.members && workspace.members[0]) {
        userRole = workspace.members[0].workspaceRole?.name || 'Member';
      }

      return {
        ...workspace,
        is_owner: isOwner,
        user_role: userRole,
        members: undefined, // Remove members from response
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
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

  /**
   * Thống kê tổng quan workspaces & chatbots (dành cho admin hệ thống).
   */
  async getStatsSummary(): Promise<WorkspaceStatsSummaryDto> {
    const now = Date.now();
    const since7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      total_workspaces,
      total_chatbots,
      workspaces_last_7_days,
      workspaces_last_30_days,
      chatbots_last_7_days,
      chatbots_last_30_days,
    ] = await Promise.all([
      this.workspaceRepository.count(),
      this.chatbotRepository.count(),
      this.workspaceRepository
        .createQueryBuilder('w')
        .where('w.created_at >= :since', { since: since7Days })
        .getCount(),
      this.workspaceRepository
        .createQueryBuilder('w')
        .where('w.created_at >= :since', { since: since30Days })
        .getCount(),
      this.chatbotRepository
        .createQueryBuilder('c')
        .where('c.created_at >= :since', { since: since7Days })
        .getCount(),
      this.chatbotRepository
        .createQueryBuilder('c')
        .where('c.created_at >= :since', { since: since30Days })
        .getCount(),
    ]);

    const avg_chatbots_per_workspace =
      total_workspaces > 0 ? total_chatbots / total_workspaces : 0;

    return {
      total_workspaces,
      total_chatbots,
      avg_chatbots_per_workspace,
      workspaces_last_7_days,
      workspaces_last_30_days,
      chatbots_last_7_days,
      chatbots_last_30_days,
    };
  }
}
