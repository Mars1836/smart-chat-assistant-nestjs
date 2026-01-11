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
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto, MessageResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';

@ApiTags('messages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo message mới' })
  @ApiResponse({
    status: 201,
    description: 'Message created successfully',
    type: MessageResponseDto,
  })
  create(
    @User('sub') userId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.create(userId, createMessageDto);
  }

  @Get('conversations/:conversationId')
  @ApiExtraModels(
    MessageResponseDto,
    PaginatedResponseDto,
    PaginationMetaDto,
    PaginationDto,
  )
  @ApiOperation({
    summary: 'Lấy danh sách messages của conversation (có phân trang)',
    description:
      'Trả về danh sách messages của conversation với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of messages in conversation',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(MessageResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            conversation_id: 'conversation-uuid-here',
            sender_type: 'user',
            sender_id: 'user-uuid-here',
            content: 'Xin chào! Bạn có thể giúp tôi không?',
            intent_id: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            conversation_id: 'conversation-uuid-here',
            sender_type: 'bot',
            sender_id: null,
            content: 'Xin chào! Tôi có thể giúp gì cho bạn?',
            intent_id: 'intent-uuid-here',
            created_at: '2024-01-01T00:00:01.000Z',
            updated_at: '2024-01-01T00:00:01.000Z',
          },
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    },
  })
  findAllByConversation(
    @Param('conversationId') conversationId: string,
    @User('sub') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.messagesService.findAllByConversation(
      conversationId,
      userId,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết message' })
  @ApiResponse({
    status: 200,
    description: 'Message details',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Message not found' })
  findOne(@Param('id') id: string, @User('sub') userId: string) {
    return this.messagesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật message' })
  @ApiResponse({
    status: 200,
    description: 'Message updated successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Cannot update bot messages' })
  update(
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.messagesService.update(id, userId, updateMessageDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa message' })
  @ApiResponse({
    status: 200,
    description: 'Message deleted successfully',
  })
  @ApiResponse({ status: 403, description: 'Cannot delete bot messages' })
  remove(@Param('id') id: string, @User('sub') userId: string) {
    return this.messagesService.remove(id, userId);
  }
}
