import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
import { DocumentParsingService } from '../services/document-parsing.service';
import { VectorStoreService } from '../services/vector-store.service';
import { RagEventsService } from '../services/rag-events.service';
import { AIStudioService } from '../../../common/providers/aistudio';
import * as path from 'path';
import * as fs from 'fs';

@Processor('document-queue')
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly parsingService: DocumentParsingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly aiStudio: AIStudioService,
    private readonly eventsService: RagEventsService,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string; filePath: string; mimetype: string }>): Promise<any> {
    const { documentId, filePath, mimetype } = job.data;
    // Remove leading slash to ensure proper relative path resolution on Windows
    const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const absolutePath = path.resolve(process.cwd(), normalizedPath);

    this.logger.log(`Start processing document ${documentId}`);
    
    try {
      // 1. Start
      await this.updateProgress(documentId, 10, 'Đang đọc thẻ...');
      
      // 2. Extract
      const text = await this.parsingService.extractText(absolutePath, mimetype);
      await this.updateProgress(documentId, 30, 'Đang chia nhỏ văn bản...');
      
      // 3. Chunk
      const chunks = await this.parsingService.chunkText(text);
      await this.documentRepo.update(documentId, { chunk_count: chunks.length });
      await this.updateProgress(documentId, 40, `Đã chia thành ${chunks.length} đoạn. Đang tạo vector...`);

      // 4. Embed & Save
      // Delete old vectors if any
      await this.vectorStoreService.deleteByDocumentId(documentId);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Rate limit mitigation: sleep slightly? Gemini is fast but generous rate limits.
        // Parallelize? Be careful with API limits. Sequential is safer for now.
        const embedding = await this.aiStudio.generateEmbedding(chunk);
        
        await this.vectorStoreService.saveVector(documentId, chunk, embedding, { chunk_index: i });

        const progress = 40 + Math.floor(((i + 1) / chunks.length) * 50); // 40 -> 90
        await this.updateProgress(documentId, progress, `Đang xử lý vector ${i + 1}/${chunks.length}...`);
      }

      // 5. Finish
      await this.updateProgress(documentId, 100, 'Hoàn thành!', 'indexed');
      this.logger.log(`Finished processing document ${documentId}`);

    } catch (error) {
      this.logger.error(`Error processing document ${documentId}`, error);
      await this.documentRepo.update(documentId, {
        status: 'failed',
        error_message: error.message,
        processing_message: 'Lỗi xử lý: ' + error.message,
      });
      this.eventsService.emitProgress({
        documentId,
        status: 'failed',
        progress: 0,
        message: error.message,
      });
      throw error;
    }
  }

  private async updateProgress(documentId: string, progress: number, message: string, status: 'processing' | 'indexed' = 'processing') {
    await this.documentRepo.update(documentId, {
      status,
      processing_progress: progress,
      processing_message: message,
    });

    this.eventsService.emitProgress({
      documentId,
      status,
      progress,
      message,
    });
  }
}
