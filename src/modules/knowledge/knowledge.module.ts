import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { ChatbotKnowledge } from './entities/chatbot-knowledge.entity';
import { KnowledgeService } from './knowledge.service';
import {
  KnowledgeController,
  ChatbotKnowledgeController,
  KnowledgeAdminController,
} from './knowledge.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SystemAdminGuard } from '../users/guards/system-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Knowledge, ChatbotKnowledge]),
    AuthModule,
    UsersModule,
  ],
  controllers: [
    KnowledgeController,
    ChatbotKnowledgeController,
    KnowledgeAdminController,
  ],
  providers: [KnowledgeService, SystemAdminGuard],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
