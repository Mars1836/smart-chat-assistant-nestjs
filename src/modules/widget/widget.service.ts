import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { WidgetChatDto } from './dto/widget-chat.dto';
import { WidgetChatOrchestratorService } from './widget-chat-orchestrator.service';
import { v4 as uuidv4 } from 'uuid';
import { WidgetPublicConfigDto } from './dto/widget-public-config.dto';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly widgetChatOrchestrator: WidgetChatOrchestratorService,
  ) {}

  getPublicConfig(
    chatbot: Chatbot,
    widgetConfig: { ui?: Record<string, any> | null },
  ): WidgetPublicConfigDto {
    return {
      chatbot_id: chatbot.id,
      name: chatbot.name,
      greeting_message: chatbot.greeting_message,
      ui: widgetConfig.ui ?? null,
      conversation_starters: chatbot.conversation_starters ?? [],
    };
  }

  async chat(
    dto: WidgetChatDto,
  ): Promise<{ response: string; conversation_id: string; files?: any[]; cards?: any[] }> {
    const chatbot = await this.chatbotRepo.findOne({
      where: { id: dto.chatbotId },
    });

    if (!chatbot || !chatbot.enabled) {
      throw new NotFoundException('Chatbot not found or disabled');
    }

    // 1. Get or create conversation
    let conversation: Conversation;
    const visitorId = dto.visitorId || uuidv4();

    if (dto.conversation_id) {
      // Continue existing conversation
      const existingConv = await this.conversationRepo.findOne({
        where: { id: dto.conversation_id, chatbot_id: chatbot.id },
      });
      if (!existingConv) {
        throw new NotFoundException('Conversation not found');
      }
      conversation = existingConv;
    } else {
      // Create new conversation
      conversation = this.conversationRepo.create({
        workspace_id: chatbot.workspace_id,
        chatbot_id: chatbot.id,
        user_id: null, // widget is anonymous
        visitor_id: visitorId,
        started_at: new Date(),
      });
      await this.conversationRepo.save(conversation);
    }

    // 2. Save user message
    const userMessage = this.messageRepo.create({
      conversation: { id: conversation.id } as Conversation,
      sender_type: 'user',
      sender: null,
      content: dto.message,
    });
    await this.messageRepo.save(userMessage);

    // 3. Run chat through LangGraph orchestrator
    const result = await this.widgetChatOrchestrator.runWidgetChatTurn({
      workspaceId: chatbot.workspace_id,
      chatbotId: chatbot.id,
      conversationId: conversation.id,
      visitorId: visitorId,
      userMessage: dto.message,
      chatbot: chatbot,
    });

    // 4. Save bot response (kèm token usage và tools đã dùng)
    const botMessage = this.messageRepo.create({
      conversation: { id: conversation.id } as Conversation,
      sender_type: 'bot',
      sender: null,
      content: result.response,
      token_usage: result.tokenUsage ?? null,
      tools_used: result.toolsUsed?.length ? result.toolsUsed : null,
    });
    await this.messageRepo.save(botMessage);

    return {
      response: result.response,
      conversation_id: conversation.id,
      files: result.files,
      cards: result.cards,
    };
  }
}
