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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  getSchemaPath,
} from '@nestjs/swagger';
import { ChatbotsService } from './chatbots.service';
import {
  CreateChatbotDto,
  UpdateChatbotDto,
  ChatDto,
  ChatResponseDto,
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

@ApiTags('chatbots')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/chatbots')
export class ChatbotsController {
  constructor(private readonly chatbotsService: ChatbotsService) {}

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
            llm_provider: 'google-ai-studio',
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

  @Post(':id/chat')
  @ApiOperation({ summary: 'Chat với chatbot' })
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
  ) {
    return this.chatbotsService.chat(workspaceId, id, userId, chatDto);
  }

  @Get('_/models')
  @ApiOperation({ summary: 'Danh sách models có sẵn' })
  @ApiResponse({
    status: 200,
    description: 'List of available AI models',
    type: [String],
  })
  listModels() {
    return this.chatbotsService.listModels();
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
