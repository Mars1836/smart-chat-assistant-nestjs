import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { ChatbotKnowledge } from './entities/chatbot-knowledge.entity';
import { KnowledgeService } from './knowledge.service';
import {
  KnowledgeController,
  ChatbotKnowledgeController,
} from './knowledge.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Knowledge, ChatbotKnowledge]),
    AuthModule,
  ],
  controllers: [KnowledgeController, ChatbotKnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
