import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { ToolAction } from './entities/tool-action.entity';
import { WorkspaceTool } from './entities/workspace-tool.entity';
import { UserToolCredential } from './entities/user-tool-credential.entity';
import { CreateToolDto, CreateToolActionDto } from './dto/create-tool.dto';
import { UpdateToolDto, UpdateToolActionDto } from './dto/update-tool.dto';
import {
  maskApiKeyInConfigOverride,
  sanitizeToolAuthConfig,
} from './utils/secret-mask.util';
import { validateNoPrivateOutboundUrls } from './utils/tool-config-validation.util';

export interface ToolWithMeta extends Tool {
  workspace_tool?: {
    is_enabled: boolean;
    config_override: Record<string, any> | null;
    added_by: string | null;
    created_at: Date;
    updated_at: Date;
  };
  user_auth_status?: {
    connected: boolean;
    profile: {
      email?: string;
      name?: string;
      picture?: string;
    } | null;
    connected_at: Date | null;
  };
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(ToolAction)
    private readonly toolActionRepo: Repository<ToolAction>,
    @InjectRepository(WorkspaceTool)
    private readonly workspaceToolRepo: Repository<WorkspaceTool>,
    @InjectRepository(UserToolCredential)
    private readonly userCredentialRepo: Repository<UserToolCredential>,
  ) {}

  async findAll(params?: {
    category?: 'builtin' | 'custom' | 'community';
    is_enabled?: boolean;
  }): Promise<Tool[]> {
    const where: any = {};

    if (params?.category) {
      where.category = params.category;
    }
    if (params?.is_enabled !== undefined) {
      where.is_enabled = params.is_enabled;
    }

    return this.toolRepo.find({
      where,
      relations: ['actions'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Get all tools available for a workspace
   * Includes: builtin tools + custom tools (all custom tools are available to all workspaces)
   */
  async findAllByWorkspace(workspaceId: string): Promise<ToolWithMeta[]> {
    return this.findAllByWorkspaceWithAuth(workspaceId);
  }

  /**
   * Get all tools with workspace metadata and user auth status
   * @param workspaceId - Workspace ID
   * @param userId - Optional user ID for OAuth status
   */
  async findAllByWorkspaceWithAuth(
    workspaceId: string,
    userId?: string,
  ): Promise<ToolWithMeta[]> {
    // Get workspace tool metadata first (installed tool_ids for this workspace)
    const workspaceTools = await this.workspaceToolRepo.find({
      where: { workspace_id: workspaceId },
    });
    const wsToolMap = new Map<string, WorkspaceTool>();
    workspaceTools.forEach((wt) => wsToolMap.set(wt.tool_id, wt));
    const installedToolIds = workspaceTools.map((wt) => wt.tool_id);

    // Builtin tools (all) + custom tools CHỈ khi đã cài vào workspace (không hiện custom chưa cài)
    const whereConditions: any[] = [{ category: 'builtin', is_enabled: true }];
    if (installedToolIds.length > 0) {
      whereConditions.push({
        category: 'custom',
        is_enabled: true,
        id: In(installedToolIds),
      });
    }
    const tools = await this.toolRepo.find({
      where: whereConditions,
      relations: ['actions'],
      order: { category: 'ASC', name: 'ASC' },
    });

    // Get user OAuth credentials if userId provided
    const userCredMap = new Map<string, UserToolCredential>();
    if (userId) {
      const credentials = await this.userCredentialRepo.find({
        where: { user_id: userId, workspace_id: workspaceId },
      });
      credentials.forEach((c) => userCredMap.set(c.tool_id, c));
    }

    return tools.map((tool) => {
      const wsMeta = wsToolMap.get(tool.id);
      const userCred = userCredMap.get(tool.id);

      const result: ToolWithMeta = {
        ...tool,
        auth_config: sanitizeToolAuthConfig((tool as any).auth_config),
        workspace_tool: wsMeta
          ? {
              is_enabled: wsMeta.is_enabled,
              config_override: maskApiKeyInConfigOverride(
                wsMeta.config_override,
              ),
              added_by: wsMeta.added_by,
              created_at: wsMeta.created_at,
              updated_at: wsMeta.updated_at,
            }
          : undefined,
      };

      // Include user auth status for OAuth tools
      if (tool.auth_config?.type === 'oauth2') {
        result.user_auth_status = userCred?.is_active
          ? {
              connected: true,
              profile: userCred.profile,
              connected_at: userCred.connected_at,
            }
          : {
              connected: false,
              profile: null,
              connected_at: null,
            };
      }

      return result;
    });
  }

  /**
   * Get ONLY tools that have been installed/added to a workspace
   * (Has record in workspace_tools table)
   * Includes user OAuth status for tools requiring authentication
   */
  async findWorkspaceInstalledTools(
    workspaceId: string,
    userId?: string,
  ): Promise<ToolWithMeta[]> {
    // Get all workspace tools (installed plugins)
    const workspaceTools = await this.workspaceToolRepo.find({
      where: { workspace_id: workspaceId },
      relations: ['tool', 'tool.actions'],
    });

    if (workspaceTools.length === 0) {
      return [];
    }

    // Get user OAuth credentials if userId provided
    const userCredMap = new Map<string, UserToolCredential>();
    if (userId) {
      const credentials = await this.userCredentialRepo.find({
        where: { user_id: userId, workspace_id: workspaceId },
      });
      credentials.forEach((c) => userCredMap.set(c.tool_id, c));
    }

    return workspaceTools.map((wt) => {
      const tool = wt.tool;
      const userCred = userCredMap.get(tool.id);

      const result: ToolWithMeta = {
        ...tool,
        auth_config: sanitizeToolAuthConfig((tool as any).auth_config),
        workspace_tool: {
          is_enabled: wt.is_enabled,
          config_override: maskApiKeyInConfigOverride(wt.config_override),
          added_by: wt.added_by,
          created_at: wt.created_at,
          updated_at: wt.updated_at,
        },
      };

      // Include user auth status for OAuth tools
      if (tool.auth_config?.type === 'oauth2') {
        result.user_auth_status = userCred?.is_active
          ? {
              connected: true,
              profile: userCred.profile,
              connected_at: userCred.connected_at,
            }
          : {
              connected: false,
              profile: null,
              connected_at: null,
            };
      }

      return result;
    });
  }

  async findOne(id: string): Promise<Tool> {
    const tool = await this.toolRepo.findOne({
      where: { id },
      relations: ['actions'],
    });
    if (!tool) {
      throw new NotFoundException(`Tool with id '${id}' not found`);
    }
    return tool;
  }

  async findByName(name: string): Promise<Tool | null> {
    return this.toolRepo.findOne({
      where: { name },
      relations: ['actions'],
    });
  }

  async create(dto: CreateToolDto): Promise<Tool> {
    const { actions, ...toolData } = dto;

    await validateNoPrivateOutboundUrls(
      dto.executor_config,
      'Tool executor_config',
    );
    await validateNoPrivateOutboundUrls(dto.auth_config, 'Tool auth_config');

    // Create tool first
    const tool = this.toolRepo.create({
      ...toolData,
      category: dto.category ?? 'custom',
      is_enabled: dto.is_enabled ?? true,
    });
    const savedTool = await this.toolRepo.save(tool);

    // Create actions if provided
    if (actions && actions.length > 0) {
      for (const actionDto of actions) {
        await validateNoPrivateOutboundUrls(
          actionDto.executor_config,
          `Action executor_config (${actionDto.name})`,
        );
        const action = this.toolActionRepo.create({
          tool_id: savedTool.id,
          name: actionDto.name,
          display_name: actionDto.display_name,
          description: actionDto.description,
          parameters: actionDto.parameters || {},
          executor_config: actionDto.executor_config || null,
          sort_order: actionDto.sort_order || 0,
          is_enabled: actionDto.is_enabled ?? true,
          card_config: actionDto.card_config ?? null,
        });
        await this.toolActionRepo.save(action);
      }
    }

    // Return tool with actions
    return this.findOne(savedTool.id);
  }

  async update(id: string, dto: UpdateToolDto): Promise<Tool> {
    const tool = await this.findOne(id);
    const { actions, ...toolData } = dto;

    if (dto.executor_config !== undefined) {
      await validateNoPrivateOutboundUrls(
        dto.executor_config,
        'Tool executor_config',
      );
    }
    if (dto.auth_config !== undefined) {
      await validateNoPrivateOutboundUrls(dto.auth_config, 'Tool auth_config');
    }

    // Update tool data
    Object.assign(tool, toolData);
    await this.toolRepo.save(tool);

    // If actions provided, update/replace them
    if (actions !== undefined) {
      // Delete existing actions
      await this.toolActionRepo.delete({ tool_id: id });

      // Create new actions
      for (const actionDto of actions) {
        await validateNoPrivateOutboundUrls(
          actionDto.executor_config,
          `Action executor_config (${actionDto.name})`,
        );
        const action = this.toolActionRepo.create({
          tool_id: id,
          name: actionDto.name,
          display_name: actionDto.display_name,
          description: actionDto.description,
          parameters: actionDto.parameters || {},
          executor_config: actionDto.executor_config || null,
          sort_order: actionDto.sort_order || 0,
          is_enabled: actionDto.is_enabled ?? true,
          card_config: actionDto.card_config ?? null,
        });
        await this.toolActionRepo.save(action);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const tool = await this.findOne(id);
    // Actions will be deleted via CASCADE
    await this.toolRepo.remove(tool);
  }

  // =====================
  // ACTION MANAGEMENT
  // =====================

  async findAction(toolId: string, actionId: string): Promise<ToolAction> {
    const action = await this.toolActionRepo.findOne({
      where: { id: actionId, tool_id: toolId },
    });
    if (!action) {
      throw new NotFoundException(`Action with id '${actionId}' not found`);
    }
    return action;
  }

  async createAction(
    toolId: string,
    dto: CreateToolActionDto,
  ): Promise<ToolAction> {
    // Verify tool exists
    await this.findOne(toolId);

    await validateNoPrivateOutboundUrls(
      dto.executor_config,
      `Action executor_config (${dto.name})`,
    );

    const action = this.toolActionRepo.create({
      tool_id: toolId,
      name: dto.name,
      display_name: dto.display_name,
      description: dto.description,
      parameters: dto.parameters || {},
      executor_config: dto.executor_config || null,
      sort_order: dto.sort_order || 0,
      is_enabled: dto.is_enabled ?? true,
      card_config: dto.card_config ?? null,
    });

    return this.toolActionRepo.save(action);
  }

  async updateAction(
    toolId: string,
    actionId: string,
    dto: UpdateToolActionDto,
  ): Promise<ToolAction> {
    const action = await this.findAction(toolId, actionId);
    if (dto.executor_config !== undefined) {
      await validateNoPrivateOutboundUrls(
        dto.executor_config,
        `Action executor_config (${action.name})`,
      );
    }
    Object.assign(action, dto);
    return this.toolActionRepo.save(action);
  }

  async removeAction(toolId: string, actionId: string): Promise<void> {
    const action = await this.findAction(toolId, actionId);
    await this.toolActionRepo.remove(action);
  }

  async getActionsForTool(toolId: string): Promise<ToolAction[]> {
    return this.toolActionRepo.find({
      where: { tool_id: toolId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }
}
