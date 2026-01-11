import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Chatbot } from '../chatbots/entities/chatbot.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Workspace, Chatbot]),
    AuthModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [TypeOrmModule, ConversationsService],
})
export class ConversationsModule {}
