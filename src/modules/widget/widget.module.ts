import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { RagModule } from '../rag/rag.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ToolsModule } from '../tools/tools.module';
import { BillingModule } from '../billing/billing.module';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { GeminiProvider } from '../../common/providers/gemini.provider';
import { OpenAIProvider } from '../../common/providers/openai.provider';
import { RedisRateLimiterService } from '../../common/rate-limiter/redis-rate-limiter.service';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { WidgetChatOrchestratorService } from './widget-chat-orchestrator.service';
import { WidgetSecurityService } from './widget-security.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chatbot, Conversation, Message]),
    RagModule,
    KnowledgeModule,
    ToolsModule, // export ToolRegistryService & ToolExecutorService
    BillingModule,
  ],
  controllers: [WidgetController],
  providers: [
    WidgetService,
    WidgetChatOrchestratorService,
    RedisRateLimiterService,
    WidgetSecurityService,
    // LLM providers (riêng cho widget)
    LLMFactoryService,
    GeminiProvider,
    OpenAIProvider,
  ],
})
export class WidgetModule {}

