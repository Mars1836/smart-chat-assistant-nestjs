import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DocumentVector } from './entities/document-vector.entity';
import { DocumentParsingService } from './services/document-parsing.service';
import { VectorStoreService } from './services/vector-store.service';
import { QdrantService } from './services/qdrant.service';
import { RagEventsService } from './services/rag-events.service';
import { DocumentProcessingProcessor } from './processors/document-processing.processor';
import { Document } from '../documents/entities/document.entity';
import { RagService } from './rag.service';
import { GeminiProvider } from '../../common/providers/gemini.provider';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentVector, Document]),
    WorkspacesModule,
    KnowledgeModule,
    BullModule.registerQueue({
      name: 'document-queue',
    }),
  ],
  providers: [
    QdrantService,
    DocumentParsingService,
    VectorStoreService,
    RagEventsService,
    DocumentProcessingProcessor,
    DocumentProcessingProcessor,
    RagService,
    GeminiProvider,
  ],
  exports: [TypeOrmModule, RagService, RagEventsService],
})
export class RagModule {}
