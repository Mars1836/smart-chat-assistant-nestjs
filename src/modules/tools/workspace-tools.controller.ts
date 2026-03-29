import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ToolsService, ToolWithMeta } from './tools.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { WorkspaceToolsService } from './workspace-tools.service';
import { AddWorkspaceToolDto } from './dto/add-workspace-tool.dto';
import { UpdateWorkspaceToolDto } from './dto/update-workspace-tool.dto';
import { CreateToolDto } from './dto/create-tool.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Request } from 'express';
import { maskApiKeyInConfigOverride } from './utils/secret-mask.util';

@ApiTags('workspace-tools')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/tools')
export class WorkspaceToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly workspaceToolsService: WorkspaceToolsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy tất cả plugins có sẵn để cài đặt vào workspace',
    description:
      'Trả về tất cả builtin tools + custom tools, kèm thông tin nếu đã được thêm vào workspace (workspace_tool != null).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all available tools with workspace_tool metadata',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getAvailableTools(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: any,
    @Query('category') category?: 'builtin' | 'custom' | 'community',
    @Query('search') search?: string,
    @Query('installed') installed?: string,
    @Query('sortBy')
    sortBy: 'name' | 'category' | 'created_at' = 'name',
    @Query('sortOrder')
    sortOrder: 'asc' | 'desc' = 'asc',
  ): Promise<ToolWithMeta[]> {
    let tools = await this.toolsService.findAllByWorkspaceWithAuth(
      workspaceId,
      user?.sub,
    );

    // Filter by category
    if (category) {
      tools = tools.filter((t) => t.category === category);
    }

    // Filter by installed flag (true/false)
    if (installed !== undefined) {
      const isInstalled =
        installed === 'true' || installed === '1' || installed === 'yes';
      tools = tools.filter((t) =>
        isInstalled ? !!t.workspace_tool : !t.workspace_tool,
      );
    }

    // Text search by name / display_name / description
    if (search && search.trim()) {
      const q = search.toLowerCase();
      tools = tools.filter((t) => {
        const name = t.name?.toLowerCase?.() || '';
        const display = t.display_name?.toLowerCase?.() || '';
        const desc = t.description?.toLowerCase?.() || '';
        return name.includes(q) || display.includes(q) || desc.includes(q);
      });
    }

    // Sorting
    tools.sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortBy) {
        case 'category':
          av = a.category || '';
          bv = b.category || '';
          break;
        case 'created_at':
          av = (a as any).created_at || '';
          bv = (b as any).created_at || '';
          break;
        case 'name':
        default:
          av = a.display_name || a.name || '';
          bv = b.display_name || b.name || '';
          break;
      }
      if (av < bv) return sortOrder === 'desc' ? 1 : -1;
      if (av > bv) return sortOrder === 'desc' ? -1 : 1;
      return 0;
    });

    return tools;
  }

  @Get('installed')
  @ApiOperation({
    summary: 'Lấy danh sách plugins đã cài đặt vào workspace',
    description:
      'Chỉ trả về các tools đã được thêm vào workspace (có trong bảng workspace_tools), kèm thông tin OAuth status của user hiện tại.',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of installed tools with workspace_tool and user_auth_status',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getInstalledTools(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: any,
    @Query('category') category?: 'builtin' | 'custom' | 'community',
    @Query('search') search?: string,
    @Query('sortBy')
    sortBy: 'name' | 'category' | 'created_at' = 'name',
    @Query('sortOrder')
    sortOrder: 'asc' | 'desc' = 'asc',
  ): Promise<ToolWithMeta[]> {
    let tools = await this.toolsService.findWorkspaceInstalledTools(
      workspaceId,
      user?.sub,
    );

    // Filter by category
    if (category) {
      tools = tools.filter((t) => t.category === category);
    }

    // Text search by name / display_name / description
    if (search && search.trim()) {
      const q = search.toLowerCase();
      tools = tools.filter((t) => {
        const name = t.name?.toLowerCase?.() || '';
        const display = t.display_name?.toLowerCase?.() || '';
        const desc = t.description?.toLowerCase?.() || '';
        return name.includes(q) || display.includes(q) || desc.includes(q);
      });
    }

    // Sorting
    tools.sort((a, b) => {
      let av: any;
      let bv: any;
      switch (sortBy) {
        case 'category':
          av = a.category || '';
          bv = b.category || '';
          break;
        case 'created_at':
          av = (a as any).created_at || '';
          bv = (b as any).created_at || '';
          break;
        case 'name':
        default:
          av = a.display_name || a.name || '';
          bv = b.display_name || b.name || '';
          break;
      }
      if (av < bv) return sortOrder === 'desc' ? 1 : -1;
      if (av > bv) return sortOrder === 'desc' ? -1 : 1;
      return 0;
    });

    return tools;
  }

  @Post('custom')
  @ApiOperation({ summary: 'Tạo custom tool/plugin mới cho workspace' })
  @ApiResponse({
    status: 201,
    description: 'Custom tool created and added to workspace',
  })
  @ApiBody({ type: CreateToolDto })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_MANAGE_PLUGINS)
  async createCustomTool(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateToolDto,
    @Req() req: Request,
  ) {
    const workspaceTool = await this.workspaceToolsService.createCustomTool(
      workspaceId,
      dto,
      (req as any).user?.id,
    );

    const toolWithMeta = await this.toolsService.findOne(workspaceTool.tool_id);
    return {
      ...toolWithMeta,
      workspace_tool: {
        is_enabled: workspaceTool.is_enabled,
        config_override: maskApiKeyInConfigOverride(
          workspaceTool.config_override,
        ),
        added_by: workspaceTool.added_by,
        created_at: workspaceTool.created_at,
        updated_at: workspaceTool.updated_at,
      },
    };
  }

  @Post()
  @ApiOperation({ summary: 'Thêm tool vào workspace (cài đặt plugin)' })
  @ApiResponse({ status: 201, description: 'Tool added to workspace' })
  @ApiBody({ type: AddWorkspaceToolDto })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_MANAGE_PLUGINS)
  async addToolToWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: AddWorkspaceToolDto,
    @Req() req: Request,
  ) {
    const workspaceTool = await this.workspaceToolsService.addToolToWorkspace(
      workspaceId,
      {
        ...dto,
        added_by: (req as any).user?.id,
      },
    );

    const toolWithMeta = await this.toolsService.findOne(dto.tool_id);
    return {
      ...toolWithMeta,
      workspace_tool: {
        is_enabled: workspaceTool.is_enabled,
        config_override: maskApiKeyInConfigOverride(
          workspaceTool.config_override,
        ),
        added_by: workspaceTool.added_by,
        created_at: workspaceTool.created_at,
        updated_at: workspaceTool.updated_at,
      },
    };
  }

  @Put(':toolId')
  @ApiOperation({ summary: 'Cập nhật trạng thái/config tool ở workspace' })
  @ApiResponse({ status: 200, description: 'Workspace tool updated' })
  @ApiBody({ type: UpdateWorkspaceToolDto })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_MANAGE_PLUGINS)
  async updateWorkspaceTool(
    @Param('workspaceId') workspaceId: string,
    @Param('toolId') toolId: string,
    @Body() dto: UpdateWorkspaceToolDto,
  ) {
    const updated = await this.workspaceToolsService.updateWorkspaceTool(
      workspaceId,
      toolId,
      dto,
    );
    const tool = await this.toolsService.findOne(toolId);
    return {
      ...tool,
      workspace_tool: {
        is_enabled: updated.is_enabled,
        config_override: maskApiKeyInConfigOverride(updated.config_override),
        added_by: updated.added_by,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    };
  }

  @Delete(':toolId')
  @ApiOperation({
    summary: 'Gỡ tool khỏi workspace',
    description:
      'Gỡ cài đặt plugin khỏi workspace và tất cả chatbots thuộc workspace',
  })
  @ApiResponse({ status: 204, description: 'Tool removed from workspace' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_MANAGE_PLUGINS)
  async removeWorkspaceTool(
    @Param('workspaceId') workspaceId: string,
    @Param('toolId') toolId: string,
  ): Promise<void> {
    await this.workspaceToolsService.removeWorkspaceTool(workspaceId, toolId);
  }

  @Delete('custom/:toolId')
  @ApiOperation({
    summary: 'Xóa hẳn custom plugin của workspace',
    description:
      'Chỉ áp dụng cho custom tools (category=custom, is_public=false) được tạo bởi workspace này. ' +
      'Kiểm tra quyền WORKSPACE_MANAGE_PLUGINS và người tạo plugin.',
  })
  @ApiResponse({
    status: 204,
    description: 'Custom plugin deleted successfully',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_MANAGE_PLUGINS)
  async deleteCustomTool(
    @Param('workspaceId') workspaceId: string,
    @Param('toolId') toolId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    // user.sub là ID user từ JWT (tuỳ bạn map), fallback sang user.id nếu cần
    const userId = user?.sub ?? user?.id;
    await this.workspaceToolsService.deleteCustomTool(
      workspaceId,
      toolId,
      userId,
    );
  }
}
