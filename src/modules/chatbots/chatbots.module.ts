import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Chatbot } from './entities/chatbot.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { MessageAttachment } from '../messages/entities/message-attachment.entity';
import { ChatbotsController } from './chatbots.controller';
import { ChatbotsService } from './chatbots.service';
import { GeminiProvider } from '../../common/providers/gemini.provider';
import { OpenAIProvider } from '../../common/providers/openai.provider';
import { LLMFactoryService } from '../../common/providers/llm-factory.service';
import { RagModule } from '../rag/rag.module';
import { ToolsModule } from '../tools/tools.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatOrchestratorService } from './chat-orchestrator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chatbot, Workspace, Conversation, Message, MessageAttachment]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'your-secret-key',
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES_IN') ?? '1h',
        } as any,
      }),
      inject: [ConfigService],
    }),

    RagModule,
    ToolsModule,
    KnowledgeModule,
  ],
  controllers: [ChatbotsController],
  providers: [
    ChatbotsService,
    GeminiProvider,
    OpenAIProvider,
    LLMFactoryService,
    ChatOrchestratorService,
  ],
  exports: [TypeOrmModule, ChatbotsService],
})
export class ChatbotsModule {}
