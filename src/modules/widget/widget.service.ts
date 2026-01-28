import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { RagService } from '../rag/rag.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolExecutorService } from '../tools/tool-executor.service';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { WidgetChatDto } from './dto/widget-chat.dto';
import { LLMMessage } from '../../common/interfaces/llm-provider.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Chatbot)
    private readonly chatbotRepo: Repository<Chatbot>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly ragService: RagService,
    private readonly knowledgeService: KnowledgeService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly llmFactory: LLMFactoryService,
  ) {}

  async chat(dto: WidgetChatDto): Promise<{ response: string; conversation_id: string }> {
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

    // 3. Get previous messages for context (limit to last 10)
    const previousMessages = await this.messageRepo.find({
      where: { conversation: { id: conversation.id } },
      order: { created_at: 'ASC' },
      take: 20, // Get last 20 messages for context
    });

    // 4. RAG context
    const knowledgeIds =
      await this.knowledgeService.getEnabledKnowledgeIdsForChatbot(chatbot.id);

    const contexts =
      knowledgeIds.length > 0
        ? await this.ragService.searchForChatbot(
            dto.message,
            chatbot.id,
            knowledgeIds,
            3,
            chatbot.confidence_threshold,
          )
        : [];

    const contextString =
      contexts.length > 0
        ? `\n\n[Context Information]:\n${contexts.join('\n\n')}\n\n[End Context]`
        : '';

    const systemInstruction =
      this.buildSystemInstruction(chatbot) + contextString;

    // 5. Tools cho chatbot
    const tools = await this.toolRegistry.formatForLLMWithPermissions(
      chatbot.id,
    );

    const provider = this.llmFactory.getProvider(chatbot.llm_model);

    // 6. Build message history for LLM
    const llmMessages: LLMMessage[] = previousMessages.map((msg) => ({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.content,
    })) as LLMMessage[];

    // 7. First LLM call
    const first = await provider.chat(chatbot.llm_model, llmMessages, {
      temperature: chatbot.temperature,
      maxTokens: chatbot.max_tokens,
      systemInstruction,
      tools,
    });

    let botResponse: string;

    if (!first.functionCalls || first.functionCalls.length === 0) {
      if (!first.text) {
        throw new BadRequestException('LLM returned no text');
      }
      botResponse = first.text;
    } else {
      // 8. Execute tools
      const calls = first.functionCalls;
      const toolResults = await Promise.all(
        calls.map(async (call) => {
          try {
            const result = await this.toolExecutor.execute(call.name, call.args, {
              workspaceId: chatbot.workspace_id,
              userId: 'widget',
              sessionId: conversation.id,
              chatbotId: chatbot.id,
            });
            return { name: call.name, result };
          } catch (e: any) {
            return { name: call.name, result: { error: e?.message ?? String(e) } };
          }
        }),
      );

      const fnMessages: LLMMessage[] = [
        ...llmMessages,
        ...toolResults.map<LLMMessage>((t) => ({
          role: 'function',
          name: t.name,
          functionResponse: { name: t.name, response: t.result },
        })),
      ];

      const second = await provider.chat(chatbot.llm_model, fnMessages, {
        temperature: chatbot.temperature,
        maxTokens: chatbot.max_tokens,
        systemInstruction,
        tools,
      });

      if (!second.text) {
        throw new BadRequestException('LLM returned no final text');
      }
      botResponse = second.text;
    }

    // 9. Save bot response
    const botMessage = this.messageRepo.create({
      conversation: { id: conversation.id } as Conversation,
      sender_type: 'bot',
      sender: null,
      content: botResponse,
    });
    await this.messageRepo.save(botMessage);

    return { response: botResponse, conversation_id: conversation.id };
  }

  private buildSystemInstruction(chatbot: Chatbot): string {
    const parts: string[] = [];

    if (chatbot.personality) {
      parts.push(chatbot.personality);
    }

    parts.push(`Bạn đang trả lời bằng ngôn ngữ: ${chatbot.language}`);

    if (chatbot.greeting_message) {
      parts.push(`Tin nhắn chào: "${chatbot.greeting_message}"`);
    }

    parts.push(
      'Hãy trả lời một cách ngắn gọn, rõ ràng và hữu ích. Nếu không chắc chắn, hãy thừa nhận và đề xuất cách khác.',
    );

    return parts.join('\n');
  }
}
