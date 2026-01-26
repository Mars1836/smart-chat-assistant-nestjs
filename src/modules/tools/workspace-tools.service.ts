import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorkspaceTool } from './entities/workspace-tool.entity';
import { Tool } from './entities/tool.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { ChatbotTool } from './entities/chatbot-tool.entity';
import { ChatbotToolAction } from './entities/chatbot-tool-action.entity';
import { AddWorkspaceToolDto } from './dto/add-workspace-tool.dto';
import { UpdateWorkspaceToolDto } from './dto/update-workspace-tool.dto';
import { CreateToolDto } from './dto/create-tool.dto';

@Injectable()
export class WorkspaceToolsService {
  constructor(
    @InjectRepository(WorkspaceTool)
    private readonly workspaceToolRepo: Repository<WorkspaceTool>,
    @InjectRepository(Tool)
    private readonly toolRepo: Repository<Tool>,
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
    @InjectRepository(ChatbotTool)
    private readonly chatbotToolRepo: Repository<ChatbotTool>,
    @InjectRepository(ChatbotToolAction)
    private readonly chatbotToolActionRepo: Repository<ChatbotToolAction>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<WorkspaceTool[]> {
    return this.workspaceToolRepo.find({
      where: { workspace_id: workspaceId },
    });
  }

  async findOne(
    workspaceId: string,
    toolId: string,
  ): Promise<WorkspaceTool | null> {
    return this.workspaceToolRepo.findOne({
      where: { workspace_id: workspaceId, tool_id: toolId },
    });
  }

  async addToolToWorkspace(
    workspaceId: string,
    dto: AddWorkspaceToolDto & { added_by?: string },
  ): Promise<WorkspaceTool> {
    const tool = await this.toolRepo.findOne({ where: { id: dto.tool_id } });
    if (!tool || !tool.is_enabled) {
      throw new NotFoundException('Tool not found or disabled');
    }

    const existing = await this.findOne(workspaceId, dto.tool_id);
    if (existing) {
      throw new BadRequestException('Tool already added to workspace');
    }

    const workspaceTool = this.workspaceToolRepo.create({
      workspace_id: workspaceId,
      tool_id: dto.tool_id,
      is_enabled: dto.is_enabled ?? true,
      config_override: dto.config_override ?? null,
      added_by: dto.added_by ?? null,
      created_by_id: dto.added_by ?? null,
    });

    return this.workspaceToolRepo.save(workspaceTool);
  }

  async updateWorkspaceTool(
    workspaceId: string,
    toolId: string,
    dto: UpdateWorkspaceToolDto,
  ): Promise<WorkspaceTool> {
    const workspaceTool = await this.findOne(workspaceId, toolId);
    if (!workspaceTool) {
      throw new NotFoundException('Tool not installed in workspace');
    }

    if (dto.is_enabled !== undefined) {
      workspaceTool.is_enabled = dto.is_enabled;
    }
    if (dto.config_override !== undefined) {
      workspaceTool.config_override = dto.config_override;
    }

    return this.workspaceToolRepo.save(workspaceTool);
  }

  async removeWorkspaceTool(workspaceId: string, toolId: string): Promise<void> {
    const workspaceTool = await this.findOne(workspaceId, toolId);
    if (!workspaceTool) {
      throw new NotFoundException('Tool not installed in workspace');
    }

    // Remove chatbot tool actions & tools for chatbots in this workspace
    const chatbots = await this.chatbotRepo.find({
      where: { workspace_id: workspaceId },
      select: ['id'],
    });
    const chatbotIds = chatbots.map((c) => c.id);

    if (chatbotIds.length > 0) {
      await this.chatbotToolActionRepo.delete({
        chatbot_id: In(chatbotIds),
        tool_id: toolId,
      });
      await this.chatbotToolRepo.delete({
        chatbot_id: In(chatbotIds),
        tool_id: toolId,
      });
    }

    await this.workspaceToolRepo.remove(workspaceTool);
  }

  async createCustomTool(
    workspaceId: string,
    dto: CreateToolDto,
    userId: string,
  ): Promise<WorkspaceTool> {
    // 1. Create Tool (Force category='custom')
    const tool = this.toolRepo.create({
      ...dto,
      category: 'custom',
      is_public: false, // Custom tools are private to workspace
      created_by_id: userId,
    });
    const savedTool = await this.toolRepo.save(tool);

    // 2. Add to Workspace
    const workspaceTool = this.workspaceToolRepo.create({
      workspace_id: workspaceId,
      tool_id: savedTool.id,
      is_enabled: true,
      config_override: null,
      added_by: userId,
      created_by_id: userId,
    });

    return this.workspaceToolRepo.save(workspaceTool);
  }
}
