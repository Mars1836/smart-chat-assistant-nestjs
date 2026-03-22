import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageAttachment } from './entities/message-attachment.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Conversation } from '../conversations/entities/conversation.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation, MessageAttachment]),
    AuthModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [TypeOrmModule, MessagesService],
})
export class MessagesModule {}
