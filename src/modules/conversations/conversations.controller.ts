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
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  getSchemaPath,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';

@ApiTags('conversations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo conversation mới' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    type: ConversationResponseDto,
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CHAT)
  create(
    @User('sub') userId: string,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return this.conversationsService.create(userId, createConversationDto);
  }

  @Get()
  @ApiExtraModels(
    ConversationResponseDto,
    PaginatedResponseDto,
    PaginationMetaDto,
    PaginationDto,
  )
  @ApiOperation({
    summary: 'Lấy danh sách conversations của user (có phân trang)',
    description:
      'Trả về danh sách conversations với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of conversations',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(ConversationResponseDto) },
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
            user_id: 'user-uuid-here',
            chatbot_id: 'chatbot-uuid-here',
            started_at: '2024-01-01T00:00:00.000Z',
            ended_at: null,
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
  findAll(@User('sub') userId: string, @Query() pagination: PaginationDto) {
    return this.conversationsService.findAllByUser(userId, pagination);
  }

  @Get('workspaces/:workspaceId')
  @ApiExtraModels(
    ConversationResponseDto,
    PaginatedResponseDto,
    PaginationMetaDto,
    PaginationDto,
  )
  @ApiOperation({
    summary: 'Lấy danh sách conversations của workspace (có phân trang)',
    description:
      'Trả về danh sách conversations của workspace với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of conversations in workspace',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(ConversationResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
    },
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_CHAT)
  findAllByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @User('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.conversationsService.findAllByWorkspace(
      workspaceId,
      userId,
      pagination,
    );
  }

  @Get('chatbots/:chatbotId')
  @ApiExtraModels(
    ConversationResponseDto,
    PaginatedResponseDto,
    PaginationMetaDto,
    PaginationDto,
  )
  @ApiOperation({
    summary: 'Lấy danh sách conversations của chatbot (có phân trang)',
    description:
      'Trả về danh sách conversations của chatbot với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of conversations in chatbot',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(ConversationResponseDto) },
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
            user_id: 'user-uuid-here',
            chatbot_id: 'chatbot-uuid-here',
            started_at: '2024-01-01T00:00:00.000Z',
            ended_at: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          total: 30,
          page: 1,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    },
  })
  findAllByChatbot(
    @Param('chatbotId') chatbotId: string,
    @User('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.conversationsService.findAllByChatbot(
      chatbotId,
      userId,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  findOne(@Param('id') id: string, @User('sub') userId: string) {
    return this.conversationsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation updated successfully',
    type: ConversationResponseDto,
  })
  update(
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(id, userId, updateConversationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation deleted successfully',
  })
  remove(@Param('id') id: string, @User('sub') userId: string) {
    return this.conversationsService.remove(id, userId);
  }
}
