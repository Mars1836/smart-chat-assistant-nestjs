import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
} from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { Knowledge } from './entities/knowledge.entity';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeStatsSummaryDto } from './dto/knowledge-stats.dto';
import {
  AddKnowledgeToChatbotDto,
  UpdateChatbotKnowledgeDto,
  BatchUpdateChatbotKnowledgeDto,
} from './dto/chatbot-knowledge.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemAdminGuard } from '../users/guards/system-admin.guard';

@ApiTags('knowledge')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  // =====================
  // KNOWLEDGE BASE CRUD
  // =====================

  @Get()
  @ApiOperation({ summary: 'Get all knowledge bases in workspace' })
  @ApiResponse({ status: 200, description: 'List of knowledge bases' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async findAll(
    @Param('workspaceId') workspaceId: string,
  ): Promise<Knowledge[]> {
    return this.knowledgeService.findAllByWorkspace(workspaceId);
  }

  @Get(':knowledgeId')
  @ApiOperation({ summary: 'Get knowledge base details with documents' })
  @ApiResponse({ status: 200, description: 'Knowledge base with documents' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('knowledgeId') knowledgeId: string,
  ): Promise<Knowledge> {
    return this.knowledgeService.findOneByWorkspace(workspaceId, knowledgeId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new knowledge base' })
  @ApiResponse({ status: 201, description: 'Knowledge base created' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_UPLOAD)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateKnowledgeDto,
    @CurrentUser() user: any,
  ): Promise<Knowledge> {
    return this.knowledgeService.create(workspaceId, dto, user?.sub);
  }

  @Put(':knowledgeId')
  @ApiOperation({ summary: 'Update knowledge base' })
  @ApiResponse({ status: 200, description: 'Knowledge base updated' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_UPLOAD)
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
  ): Promise<Knowledge> {
    return this.knowledgeService.update(workspaceId, knowledgeId, dto);
  }

  @Delete(':knowledgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete knowledge base and all its documents' })
  @ApiResponse({ status: 204, description: 'Knowledge base deleted' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.DOCUMENT_DELETE)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('knowledgeId') knowledgeId: string,
  ): Promise<void> {
    return this.knowledgeService.remove(workspaceId, knowledgeId);
  }
}

// =====================
// CHATBOT KNOWLEDGE CONTROLLER
// =====================

@ApiTags('chatbot-knowledge')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/chatbots/:chatbotId/knowledge')
export class ChatbotKnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: 'Get knowledge bases linked to chatbot' })
  @ApiResponse({
    status: 200,
    description: 'List of knowledge bases with enabled status',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  async getKnowledgeForChatbot(@Param('chatbotId') chatbotId: string) {
    return this.knowledgeService.getKnowledgeForChatbot(chatbotId);
  }

  @Post()
  @ApiOperation({ summary: 'Add knowledge base to chatbot' })
  @ApiResponse({ status: 201, description: 'Knowledge added to chatbot' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async addKnowledge(
    @Param('chatbotId') chatbotId: string,
    @Body() dto: AddKnowledgeToChatbotDto,
  ) {
    return this.knowledgeService.addKnowledgeToChatbot(
      chatbotId,
      dto.knowledge_id,
      dto.priority,
      dto.is_enabled,
    );
  }

  @Put(':knowledgeId')
  @ApiOperation({ summary: 'Update knowledge config for chatbot' })
  @ApiResponse({ status: 200, description: 'Knowledge config updated' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async updateKnowledge(
    @Param('chatbotId') chatbotId: string,
    @Param('knowledgeId') knowledgeId: string,
    @Body() dto: UpdateChatbotKnowledgeDto,
  ) {
    return this.knowledgeService.updateChatbotKnowledge(
      chatbotId,
      knowledgeId,
      dto,
    );
  }

  @Delete(':knowledgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove knowledge base from chatbot' })
  @ApiResponse({ status: 204, description: 'Knowledge removed from chatbot' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async removeKnowledge(
    @Param('chatbotId') chatbotId: string,
    @Param('knowledgeId') knowledgeId: string,
  ): Promise<void> {
    return this.knowledgeService.removeKnowledgeFromChatbot(
      chatbotId,
      knowledgeId,
    );
  }

  @Post('batch')
  @ApiOperation({ summary: 'Batch update knowledge selection for chatbot' })
  @ApiResponse({ status: 200, description: 'Knowledge configs updated' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  async batchUpdate(
    @Param('chatbotId') chatbotId: string,
    @Body() dto: BatchUpdateChatbotKnowledgeDto,
  ) {
    return this.knowledgeService.batchUpdateChatbotKnowledge(
      chatbotId,
      dto.items,
    );
  }
}

@ApiTags('knowledge')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SystemAdminGuard)
@Controller('admin/knowledge')
export class KnowledgeAdminController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('stats/summary')
  @ApiOperation({
    summary: 'Thống kê tổng quan knowledge bases (chỉ admin hệ thống)',
    description:
      'Tổng số knowledge base, tổng documents, tổng dung lượng, phân loại theo status, số knowledge mới 7/30 ngày qua.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê tổng quan knowledge bases',
    type: KnowledgeStatsSummaryDto,
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin hệ thống' })
  getStatsSummary(): Promise<KnowledgeStatsSummaryDto> {
    return this.knowledgeService.getStatsSummary();
  }
}
