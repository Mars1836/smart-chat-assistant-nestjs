import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAiService } from './openai.service';
import { VectorStoreService } from './vector-store.service';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';

@Module({
  imports: [ConfigModule],
  providers: [OpenAiService, VectorStoreService, RagService],
  controllers: [RagController],
  exports: [OpenAiService, VectorStoreService, RagService],
})
export class RagModule {}
