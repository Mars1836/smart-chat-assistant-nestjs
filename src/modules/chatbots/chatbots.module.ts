import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Chatbot } from './entities/chatbot.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { ChatbotsController } from './chatbots.controller';
import { ChatbotsService } from './chatbots.service';
import { AIStudioService } from '../../common/providers';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chatbot, Workspace, Conversation, Message]),
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
  ],
  controllers: [ChatbotsController],
  providers: [ChatbotsService, AIStudioService],
  exports: [TypeOrmModule, ChatbotsService],
})
export class ChatbotsModule {}
