import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentVector } from '../entities/document-vector.entity';
import { QdrantService } from './qdrant.service';
import { Document } from '../../documents/entities/document.entity';

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    @InjectRepository(DocumentVector)
    private readonly vectorRepo: Repository<DocumentVector>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly qdrantService: QdrantService,
  ) {}

  /**
   * Save a vector for a document chunk
   * Lưu metadata vào PostgreSQL, embedding vào Qdrant
   */
  async saveVector(
    documentId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any> = {},
  ): Promise<DocumentVector> {
    // Tạo metadata record trong PostgreSQL
    const vector = this.vectorRepo.create({
      document_id: documentId,
      content,
      metadata,
    });
    const saved = await this.vectorRepo.save(vector);

    // Lưu embedding vào Qdrant với point_id = vector.id
    const pointId = saved.id;
    await this.qdrantService.upsertPoint(pointId, embedding, {
      document_id: documentId,
      content,
      ...metadata,
    });

    return saved;
  }

  /**
   * Search for similar vectors using Qdrant
   */
  async search(embedding: number[], limit = 5, workspaceId?: string): Promise<any[]> {
    try {
      // Build filter nếu có workspaceId
      let filter: Record<string, any> | undefined;
      if (workspaceId) {
        // Cần lấy danh sách document_ids thuộc workspace
        const documents = await this.documentRepo.find({
          where: { workspace_id: workspaceId },
          select: ['id'],
        });
        const documentIds = documents.map((d) => d.id);

        if (documentIds.length === 0) {
          return []; // Không có documents trong workspace
        }

        filter = {
          must: [
            {
              key: 'document_id',
              match: {
                any: documentIds,
              },
            },
          ],
        };
      }

      // Tìm kiếm trong Qdrant
      const results = await this.qdrantService.search(embedding, limit, filter);

      // Map results về format tương tự như trước
      return results.map((hit) => ({
        id: hit.id,
        content: hit.payload.content as string,
        metadata: hit.payload as Record<string, any>,
        document_id: hit.payload.document_id as string,
        similarity: hit.score, // Qdrant trả về similarity score (0-1, cao hơn = tương tự hơn)
      }));
    } catch (error) {
      this.logger.error('Error executing vector search', error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a document
   * Xóa cả trong PostgreSQL và Qdrant
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    // Xóa trong Qdrant
    await this.qdrantService.deleteByDocumentId(documentId);
    // Xóa metadata trong PostgreSQL
    await this.vectorRepo.delete({ document_id: documentId });
  }
}
