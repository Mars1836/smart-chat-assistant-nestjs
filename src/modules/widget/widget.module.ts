import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { RagModule } from '../rag/rag.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ToolsModule } from '../tools/tools.module';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { GeminiProvider } from '../../common/providers/gemini.provider';
import { OpenAIProvider } from '../../common/providers/openai.provider';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { WidgetChatOrchestratorService } from './widget-chat-orchestrator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chatbot, Conversation, Message]),
    RagModule,
    KnowledgeModule,
    ToolsModule, // export ToolRegistryService & ToolExecutorService
  ],
  controllers: [WidgetController],
  providers: [
    WidgetService,
    WidgetChatOrchestratorService,
    // LLM providers (riêng cho widget)
    LLMFactoryService,
    GeminiProvider,
    OpenAIProvider,
  ],
})
export class WidgetModule {}

