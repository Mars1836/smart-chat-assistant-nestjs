import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { CreateMessageDto, UpdateMessageDto } from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import { Conversation } from '../conversations/entities/conversation.entity';

@Injectable()
export class MessagesService extends BaseService<Message> {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {
    super();
  }

  protected getRepository(): Repository<Message> {
    return this.messageRepository;
  }

  /**
   * Tạo message mới
   */
  async create(
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    // Kiểm tra conversation tồn tại và user có quyền truy cập
    const conversation = await this.conversationRepository.findOne({
      where: { id: createMessageDto.conversation_id },
      relations: ['workspace', 'user'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Kiểm tra quyền truy cập
    if (
      conversation.user_id !== userId &&
      conversation.workspace.owner_id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    // Validate sender_type: nếu là 'user' thì phải là user của conversation
    if (createMessageDto.sender_type === 'user') {
      if (conversation.user_id !== userId) {
        throw new ForbiddenException('Only conversation user can send as user');
      }
    }

    // Tạo message
    // created_by_id sẽ được tự động thêm bởi BaseEntitySubscriber
    const message = this.messageRepository.create({
      conversation: { id: createMessageDto.conversation_id } as Conversation,
      sender_type: createMessageDto.sender_type,
      sender: createMessageDto.sender_type === 'user' ? { id: userId } : null,
      content: createMessageDto.content,
      intent: createMessageDto.intent_id
        ? { id: createMessageDto.intent_id }
        : null,
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Lấy danh sách messages của conversation (có phân trang)
   */
  async findAllByConversation(
    conversationId: string,
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<Message>> {
    // Kiểm tra conversation và quyền truy cập
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['workspace', 'user'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (
      conversation.user_id !== userId &&
      conversation.workspace.owner_id !== userId
    ) {
      throw new ForbiddenException(
        'You do not have access to this conversation',
      );
    }

    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'created_at';
      pagination.sortOrder = 'ASC';
    }

    // Override sortBy to always use created_at for messages
    const messagesPagination = {
      ...pagination,
      sortBy: 'created_at',
      sortOrder: pagination.sortOrder ?? 'ASC',
    };

    return this.paginate(messagesPagination, {
      where: { conversation: { id: conversationId } },
      relations: ['sender', 'intent', 'attachments'],
    });
  }

  /**
   * Lấy thông tin chi tiết message
   */
  async findOne(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation', 'conversation.workspace', 'sender', 'intent'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const conversation = message.conversation as Conversation & {
      workspace?: { owner_id: string };
      user_id: string;
    };

    // Kiểm tra quyền truy cập
    if (
      conversation.user_id !== userId &&
      conversation.workspace?.owner_id !== userId
    ) {
      throw new ForbiddenException('You do not have access to this message');
    }

    return message;
  }

  /**
   * Cập nhật message
   */
  async update(
    messageId: string,
    userId: string,
    updateMessageDto: UpdateMessageDto,
  ): Promise<Message> {
    const message = await this.findOne(messageId, userId);

    // Chỉ cho phép cập nhật message của user (không cho phép cập nhật bot message)
    const conversation = message.conversation as Conversation & {
      user_id: string;
    };

    if (message.sender_type === 'bot') {
      throw new ForbiddenException('Cannot update bot messages');
    }

    if (conversation.user_id !== userId) {
      throw new ForbiddenException('You can only update your own messages');
    }

    if (updateMessageDto.content !== undefined) {
      message.content = updateMessageDto.content;
    }

    if (updateMessageDto.intent_id !== undefined) {
      message.intent = updateMessageDto.intent_id
        ? ({ id: updateMessageDto.intent_id } as any)
        : null;
    }

    return await this.messageRepository.save(message);
  }

  /**
   * Xóa message
   */
  async remove(messageId: string, userId: string): Promise<void> {
    const message = await this.findOne(messageId, userId);

    // Chỉ cho phép xóa message của user (không cho phép xóa bot message)
    const conversation = message.conversation as Conversation & {
      user_id: string;
    };

    if (message.sender_type === 'bot') {
      throw new ForbiddenException('Cannot delete bot messages');
    }

    if (conversation.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.messageRepository.remove(message);
  }
}
