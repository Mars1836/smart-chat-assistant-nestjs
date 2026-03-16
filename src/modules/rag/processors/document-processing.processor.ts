import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../documents/entities/document.entity';
import { DocumentParsingService } from '../services/document-parsing.service';
import { VectorStoreService } from '../services/vector-store.service';
import { RagEventsService } from '../services/rag-events.service';
import { GeminiProvider } from '../../../common/providers/gemini.provider';
import { DocumentStorageService } from '../../../common/storage';
import { WorkspaceEncryptionService } from '../../workspaces/workspace-encryption.service';

@Processor('document-queue')
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly parsingService: DocumentParsingService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly aiStudio: GeminiProvider,
    private readonly eventsService: RagEventsService,
    private readonly workspaceEncryptionService: WorkspaceEncryptionService,
    private readonly documentStorageService: DocumentStorageService,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string; mimetype: string }>): Promise<any> {
    const { documentId, mimetype } = job.data;

    this.logger.log(`Start processing document ${documentId}`);
    
    try {
      // 1. Start
      await this.updateProgress(documentId, 10, 'Đang đọc thẻ...');
      
      // 2. Extract (giải mã nếu file đã mã hóa; bỏ qua nếu chưa mã hóa)
      const document = await this.documentRepo.findOne({
        where: { id: documentId },
      });
      if (!document) {
        throw new Error('Document not found');
      }
      let fileBuffer = await this.documentStorageService.readDocument(
        document.file_url,
      );
      if (this.workspaceEncryptionService.isEncrypted(fileBuffer)) {
        if (document.workspace_id) {
          try {
            const decrypted =
              await this.workspaceEncryptionService.decryptContent(
                document.workspace_id,
                fileBuffer,
              );
            if (decrypted) {
              fileBuffer = Buffer.from(decrypted);
            } else {
              throw new Error('Decryption returned null (DEK/Vault unavailable)');
            }
          } catch (e) {
            throw new Error(
              `File is encrypted but decryption failed: ${e instanceof Error ? e.message : e}`,
            );
          }
        } else {
          throw new Error('Encrypted file but document has no workspace_id');
        }
      }
      const text = await this.parsingService.extractTextFromBuffer(
        fileBuffer,
        mimetype,
        document.file_url,
      );
      await this.updateProgress(documentId, 30, 'Đang chia nhỏ văn bản...');

      // 3. Chunk (CSV: mỗi dòng context = 1 chunk; các loại khác: chunk theo đoạn / heading)
      let chunks: string[];
      if (mimetype === 'text/csv' || mimetype === 'csv') {
        chunks = text
          .split(/\n\n---\n\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else {
        // Gọi chunkText với hint về mimeType; sẽ tự chọn chiến lược phù hợp (md, txt/OCR, pdf/docx...)
        chunks = await this.parsingService.chunkText(text, {
          mimeType: mimetype,
        });
      }

      await this.documentRepo.update(documentId, { chunk_count: chunks.length });
      await this.updateProgress(documentId, 40, `Đã chia thành ${chunks.length} đoạn. Đang tạo vector...`);

      // 4. Embed & Save
      // Delete old vectors if any
      await this.vectorStoreService.deleteByDocumentId(documentId);

      const workspaceId = document.workspace_id;

      for (let i = 0; i < chunks.length; i++) {
        const rawChunk = chunks[i];

        // Thêm metadata (file_name) vào nội dung chunk để LLM hiểu nguồn context
        const prefix = document.file_name
          ? `[Source: ${document.file_name}]\n\n`
          : '';
        const chunk = `${prefix}${rawChunk}`;

        // Mã hóa content trước khi lưu Qdrant (bỏ qua nếu không có DEK)
        let contentToStore = chunk;
        if (workspaceId) {
          try {
            const encrypted =
              await this.workspaceEncryptionService.encryptString(
                workspaceId,
                chunk,
              );
            if (encrypted) contentToStore = encrypted;
          } catch {
            // Vault/DEK lỗi: lưu plaintext
          }
        }

        // Rate limit mitigation: sleep slightly? Gemini is fast but generous rate limits.
        const embedding = await this.aiStudio.generateEmbedding(chunk);

        await this.vectorStoreService.saveVector(
          documentId,
          contentToStore,
          embedding,
          { chunk_index: i },
        );

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
