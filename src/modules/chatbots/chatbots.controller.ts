import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFiles,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  getSchemaPath,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { ChatbotsService } from './chatbots.service';
import {
  CreateChatbotDto,
  UpdateChatbotDto,
  ChatDto,
  ChatResponseDto,
  UpdateWidgetConfigDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import { Chatbot } from './entities/chatbot.entity';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { ChatEventsService } from './chat-events.service';

@ApiTags('chatbots')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/chatbots')
export class ChatbotsController {
  constructor(
    private readonly chatbotsService: ChatbotsService,
    private readonly chatEventsService: ChatEventsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Tạo chatbot mới cho workspace' })
  @ApiResponse({
    status: 201,
    description: 'Chatbot created successfully',
    type: Chatbot,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CREATE)
  create(
    @Param('workspaceId') workspaceId: string,
    @User('sub') userId: string,
    @Body() createChatbotDto: CreateChatbotDto,
  ) {
    return this.chatbotsService.create(workspaceId, userId, createChatbotDto);
  }

  @Get()
  @ApiExtraModels(Chatbot, PaginatedResponseDto, PaginationMetaDto)
  @ApiOperation({
    summary: 'Lấy danh sách tất cả chatbots của workspace (có phân trang)',
    description:
      'Trả về danh sách chatbots với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of chatbots',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(Chatbot) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            workspace_id: 'workspace-uuid-here',
            name: 'My Chatbot',
            language: 'vi',
            personality: 'Thân thiện và chuyên nghiệp',
            enabled: true,
            greeting_message: 'Xin chào! Tôi có thể giúp gì cho bạn?',
            fallback_message: 'Xin lỗi, tôi chưa hiểu câu hỏi của bạn.',
            confidence_threshold: 0.7,
            max_context_turns: 5,
            enable_learning: true,
            llm_provider: 'google-ai-studio (backend inferred from llm_model)',
            llm_model: 'gemini-2.0-flash-lite',
            temperature: 0.7,
            max_tokens: 1000,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          total: 50,
          page: 1,
          limit: 10,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    },
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.chatbotsService.findAllByWorkspace(workspaceId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết 1 chatbot' })
  @ApiResponse({
    status: 200,
    description: 'Chatbot details',
    type: Chatbot,
  })
  @ApiResponse({ status: 404, description: 'Chatbot not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.chatbotsService.findOne(workspaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật chatbot' })
  @ApiResponse({
    status: 200,
    description: 'Chatbot updated successfully',
    type: Chatbot,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() updateChatbotDto: UpdateChatbotDto,
  ) {
    return this.chatbotsService.update(
      workspaceId,
      id,
      userId,
      updateChatbotDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa chatbot' })
  @ApiResponse({ status: 200, description: 'Chatbot deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_DELETE)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @User('sub') userId: string,
  ) {
    return this.chatbotsService.remove(workspaceId, id, userId);
  }

  @Get(':id/widget-config')
  @ApiOperation({
    summary: 'Lấy cấu hình widget (UI + bảo mật) cho chatbot',
    description:
      'Trả về cấu hình widget gắn với chatbot, bao gồm whitelist domain/IP, API key và rate limit.\n' +
      'Dùng cho trang admin FE để hiển thị và chỉnh sửa cấu hình widget public.',
  })
  @ApiResponse({
    status: 200,
    description: 'Widget config',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Chatbot not found' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  getWidgetConfig(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.chatbotsService.getWidgetConfig(workspaceId, id);
  }

  @Patch(':id/widget-config')
  @ApiOperation({
    summary: 'Cập nhật cấu hình widget (UI + bảo mật) cho chatbot',
    description:
      'Cập nhật cấu hình widget cho chatbot, bao gồm:\n' +
      '- Cấu hình UI (màu sắc, vị trí, title, greeting...).\n' +
      '- Cấu hình security: whitelist domain/IP, public API key, rate limit.\n' +
      'Endpoint này chỉ dành cho trang admin nội bộ, yêu cầu JWT + quyền CHATBOT_UPDATE.',
  })
  @ApiResponse({
    status: 200,
    description: 'Widget config updated',
    type: Chatbot,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_UPDATE)
  updateWidgetConfig(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWidgetConfigDto,
  ) {
    return this.chatbotsService.updateWidgetConfig(workspaceId, id, dto);
  }

  @Post(':id/chat')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Chat với chatbot (hỗ trợ gửi ảnh)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Tin nhắn của user' },
        conversation_id: {
          type: 'string',
          format: 'uuid',
          description: 'ID của conversation',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Ảnh đính kèm (tối đa 5 ảnh, mỗi ảnh max 10MB)',
        },
      },
      required: ['message', 'conversation_id'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Chat response',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden or Chatbot disabled' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CHAT)
  chat(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() chatDto: ChatDto,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    // Attach uploaded images to DTO
    chatDto.images = images || [];
    return this.chatbotsService.chat(workspaceId, id, userId, chatDto);
  }

  @Sse('conversations/:conversationId/stream')
  @ApiOperation({ summary: 'Theo dõi tiến trình chat/tool runtime (SSE)' })
  @ApiResponse({
    status: 200,
    description: 'Stream chat progress events',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CHAT)
  streamConversation(
    @Param('conversationId') conversationId: string,
  ): Observable<MessageEvent> {
    return this.chatEventsService.getConversationStream(conversationId);
  }

  @Get('_/models')
  @ApiOperation({ summary: 'Danh sách models có sẵn' })
  @ApiResponse({
    status: 200,
    description: 'List of available AI models',
    type: [String],
  })
  listModels() {
    return this.chatbotsService.listModelsNormalized();
  }

  @Get('_/models-selection')
  @ApiOperation({
    summary: 'Danh sách model dùng cho FE (kèm provider)',
    description:
      'Trả về đầy đủ provider/model/value/label để FE hiển thị dropdown và không cần tự suy luận provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of models with provider metadata',
  })
  listModelsForSelection() {
    return this.chatbotsService.listModelsForSelection();
  }

  @Get('_/test')
  @ApiOperation({ summary: 'Test kết nối AI Studio' })
  @ApiResponse({
    status: 200,
    description: 'Connection test result',
  })
  async testConnection() {
    const isConnected = await this.chatbotsService.testConnection();
    return {
      status: isConnected ? 'connected' : 'failed',
      message: isConnected
        ? 'AI Studio connection successful'
        : 'AI Studio connection failed',
    };
  }
}
