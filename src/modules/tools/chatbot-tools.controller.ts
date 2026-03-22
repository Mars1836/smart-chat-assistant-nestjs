import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { ToolRegistryService } from './tool-registry.service';
import { ToolsService } from './tools.service';
import { Tool } from './entities/tool.entity';
import { ToolAction } from './entities/tool-action.entity';
import { ChatbotTool } from './entities/chatbot-tool.entity';
import { ChatbotToolAction } from './entities/chatbot-tool-action.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchUpdateActionsDto } from './dto/batch-update-actions.dto';
import { WorkspaceToolsService } from './workspace-tools.service';

@ApiTags('chatbot-tools')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/chatbots/:chatbotId/tools')
export class ChatbotToolsController {
  constructor(
    private readonly toolRegistryService: ToolRegistryService,
    private readonly toolsService: ToolsService,
    private readonly workspaceToolsService: WorkspaceToolsService,
    @InjectRepository(ChatbotTool)
    private readonly chatbotToolRepo: Repository<ChatbotTool>,
    @InjectRepository(ChatbotToolAction)
    private readonly chatbotToolActionRepo: Repository<ChatbotToolAction>,
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(ToolAction)
    private readonly toolActionRepo: Repository<ToolAction>,
  ) {}

  /**
   * Validate chatbot belongs to workspace
   */
  private async validateChatbotBelongsToWorkspace(
    workspaceId: string,
    chatbotId: string,
  ): Promise<void> {
    const chatbot = await this.chatbotRepo.findOne({
      where: { id: chatbotId, workspace_id: workspaceId },
    });

    if (!chatbot) {
      throw new NotFoundException(
        'Chatbot not found or does not belong to this workspace',
      );
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tools đã bật cho chatbot',
    description:
      'Trả về danh sách tools mà chatbot này được phép dùng, kèm metadata và enabled actions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tools with chatbot-specific metadata and actions',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getToolsForChatbot(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
  ): Promise<
    Array<{
      tool: Tool;
      chatbot_tool: {
        id: string;
        is_enabled: boolean;
        config_override: Record<string, any> | null;
      };
      enabled_actions: Array<{
        action: ToolAction;
        is_enabled: boolean;
        config_override: Record<string, any> | null;
      }>;
    }>
  > {
    await this.validateChatbotBelongsToWorkspace(workspaceId, chatbotId);
    return this.toolRegistryService.getToolsForChatbotWithMetadata(chatbotId);
  }

  @Put(':toolId')
  @ApiOperation({
    summary: 'Bật/tắt tool cho chatbot hoặc cập nhật config',
    description:
      'Nếu ChatbotTool chưa tồn tại, sẽ tạo mới. Nếu đã tồn tại, sẽ cập nhật is_enabled và config_override',
  })
  @ApiResponse({
    status: 200,
    description: 'ChatbotTool updated successfully',
    type: ChatbotTool,
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async toggleToolForChatbot(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @Param('toolId') toolId: string,
    @Body()
    body: {
      is_enabled?: boolean;
      config_override?: Record<string, any>;
    },
  ): Promise<ChatbotTool> {
    await this.validateChatbotBelongsToWorkspace(workspaceId, chatbotId);

    // Ensure tool is installed & enabled at workspace level
    const workspaceTool = await this.workspaceToolsService.findOne(
      workspaceId,
      toolId,
    );
    if (!workspaceTool) {
      throw new BadRequestException(
        'Tool must be added to workspace before enabling for chatbot',
      );
    }
    if (!workspaceTool.is_enabled) {
      throw new BadRequestException('Tool is disabled at workspace level');
    }
    const existing = await this.chatbotToolRepo.findOne({
      where: { chatbot_id: chatbotId, tool_id: toolId },
    });

    if (existing) {
      if (body.is_enabled !== undefined) {
        existing.is_enabled = body.is_enabled;
      }
      if (body.config_override !== undefined) {
        existing.config_override = body.config_override;
      }
      return this.chatbotToolRepo.save(existing);
    } else {
      // Create new ChatbotTool
      const newChatbotTool = this.chatbotToolRepo.create({
        chatbot_id: chatbotId,
        tool_id: toolId,
        is_enabled: body.is_enabled ?? true,
        config_override: body.config_override ?? null,
      });
      return this.chatbotToolRepo.save(newChatbotTool);
    }
  }

  @Delete(':toolId')
  @ApiOperation({
    summary: 'Xóa tool khỏi chatbot',
    description:
      'Xóa ChatbotTool record và tất cả ChatbotToolAction liên quan',
  })
  @ApiResponse({
    status: 204,
    description: 'Tool removed from chatbot successfully',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async removeToolFromChatbot(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @Param('toolId') toolId: string,
  ): Promise<void> {
    await this.validateChatbotBelongsToWorkspace(workspaceId, chatbotId);

    // Remove all action-level permissions first
    await this.chatbotToolActionRepo.delete({
      chatbot_id: chatbotId,
      tool_id: toolId,
    });

    // Then remove tool-level permission
    const chatbotTool = await this.chatbotToolRepo.findOne({
      where: { chatbot_id: chatbotId, tool_id: toolId },
    });

    if (chatbotTool) {
      await this.chatbotToolRepo.remove(chatbotTool);
    }
  }

  // =====================
  // ACTION-LEVEL ENDPOINTS
  // =====================

  @Get(':toolId/actions')
  @ApiOperation({
    summary: 'Lấy danh sách actions của tool cho chatbot',
    description:
      'Trả về tất cả actions của tool với trạng thái enabled cho chatbot',
  })
  @ApiResponse({
    status: 200,
    description: 'List of actions with chatbot-specific metadata',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getActionsForChatbotTool(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @Param('toolId') toolId: string,
  ): Promise<
    Array<{
      action: ToolAction;
      is_enabled: boolean;
      config_override: Record<string, any> | null;
    }>
  > {
    await this.validateChatbotBelongsToWorkspace(workspaceId, chatbotId);

    // Get all actions for this tool
    const tool = await this.toolRepo.findOne({
      where: { id: toolId },
      relations: ['actions'],
    });

    if (!tool) {
      throw new NotFoundException('Tool not found');
    }

    // Get chatbot-specific action configs
    const chatbotToolActions = await this.chatbotToolActionRepo.find({
      where: { chatbot_id: chatbotId, tool_id: toolId },
    });

    const actionConfigMap = new Map<string, ChatbotToolAction>();
    for (const cta of chatbotToolActions) {
      actionConfigMap.set(cta.tool_action_id, cta);
    }

    return (tool.actions || []).map((action) => {
      const cta = actionConfigMap.get(action.id);
      return {
        action,
        is_enabled: cta?.is_enabled ?? true, // Default to enabled
        config_override: cta?.config_override ?? null,
      };
    });
  }

  @Put(':toolId/actions/:actionId')
  @ApiOperation({
    summary: 'Bật/tắt action cụ thể cho chatbot',
    description:
      'Cho phép enable/disable từng action riêng lẻ thay vì toàn bộ tool',
  })
  @ApiResponse({
    status: 200,
    description: 'ChatbotToolAction updated successfully',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async toggleActionForChatbot(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @Param('toolId') toolId: string,
    @Param('actionId') actionId: string,
    @Body()
    body: {
      is_enabled?: boolean;
      config_override?: Record<string, any>;
    },
  ): Promise<ChatbotToolAction> {
    await this.validateChatbotBelongsToWorkspace(workspaceId, chatbotId);

    // Verify action exists
    const action = await this.toolActionRepo.findOne({
      where: { id: actionId, tool_id: toolId },
    });

    if (!action) {
      throw new NotFoundException('Action not found for this tool');
    }

    const existing = await this.chatbotToolActionRepo.findOne({
      where: {
        chatbot_id: chatbotId,
        tool_id: toolId,
        tool_action_id: actionId,
      },
    });

    if (existing) {
      if (body.is_enabled !== undefined) {
        existing.is_enabled = body.is_enabled;
      }
      if (body.config_override !== undefined) {
        existing.config_override = body.config_override;
      }
      return this.chatbotToolActionRepo.save(existing);
    } else {
      const newChatbotToolAction = this.chatbotToolActionRepo.create({
        chatbot_id: chatbotId,
        tool_id: toolId,
        tool_action_id: actionId,
        is_enabled: body.is_enabled ?? true,
        config_override: body.config_override ?? null,
      });
      return this.chatbotToolActionRepo.save(newChatbotToolAction);
    }
  }

  @Post(':toolId/actions/batch')
  @ApiOperation({
    summary: 'Batch update actions cho chatbot',
    description: 'Enable/disable nhiều actions cùng lúc',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch update successful',
  })
  @ApiBody({ type: BatchUpdateActionsDto })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async batchUpdateActions(
    @Param('workspaceId') workspaceId: string,
    @Param('chatbotId') chatbotId: string,
    @Param('toolId') toolId: string,
    @Body()
    body: {
      actions: Array<{
        action_id: string;
        is_enabled: boolean;
        config_override?: Record<string, any>;
      }>;
    },
  ): Promise<{ updated: number }> {
    await this.validateChatbotBelongsToWorkspace(workspaceId, chatbotId);

    let updated = 0;

    for (const actionConfig of body.actions) {
      const existing = await this.chatbotToolActionRepo.findOne({
        where: {
          chatbot_id: chatbotId,
          tool_id: toolId,
          tool_action_id: actionConfig.action_id,
        },
      });

      if (existing) {
        existing.is_enabled = actionConfig.is_enabled;
        if (actionConfig.config_override !== undefined) {
          existing.config_override = actionConfig.config_override;
        }
        await this.chatbotToolActionRepo.save(existing);
      } else {
        await this.chatbotToolActionRepo.save(
          this.chatbotToolActionRepo.create({
            chatbot_id: chatbotId,
            tool_id: toolId,
            tool_action_id: actionConfig.action_id,
            is_enabled: actionConfig.is_enabled,
            config_override: actionConfig.config_override ?? null,
          }),
        );
      }
      updated++;
    }

    return { updated };
  }
}
