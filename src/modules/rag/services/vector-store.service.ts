import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DocumentVector } from '../entities/document-vector.entity';
import { QdrantService } from './qdrant.service';
import { Document } from '../../documents/entities/document.entity';
import { WorkspaceEncryptionService } from '../../workspaces/workspace-encryption.service';

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);

  constructor(
    @InjectRepository(DocumentVector)
    private readonly vectorRepo: Repository<DocumentVector>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly qdrantService: QdrantService,
    private readonly workspaceEncryptionService: WorkspaceEncryptionService,
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
   * @param embedding - Query embedding vector
   * @param limit - Max results
   * @param options - Filter options (workspaceId OR knowledgeIds)
   */
  async search(
    embedding: number[],
    limit = 5,
    options?: {
      workspaceId?: string;
      knowledgeIds?: string[];
      minScore?: number;
    },
  ): Promise<any[]> {
    try {
      let filter: Record<string, any> | undefined;

      // Priority: knowledgeIds > workspaceId
      if (options?.knowledgeIds && options.knowledgeIds.length > 0) {
        // Search by specific knowledge bases
        const documents = await this.documentRepo.find({
          where: options.knowledgeIds.map((kid) => ({ knowledge_id: kid })),
          select: ['id'],
        });
        const documentIds = documents.map((d) => d.id);

        if (documentIds.length === 0) {
          return []; // No documents in selected knowledge bases
        }

        filter = {
          must: [
            {
              key: 'document_id',
              match: { any: documentIds },
            },
          ],
        };
      } else if (options?.workspaceId) {
        // Fallback: search all documents in workspace
        const documents = await this.documentRepo.find({
          where: { workspace_id: options.workspaceId },
          select: ['id'],
        });
        const documentIds = documents.map((d) => d.id);

        if (documentIds.length === 0) {
          return [];
        }

        filter = {
          must: [
            {
              key: 'document_id',
              match: { any: documentIds },
            },
          ],
        };
      }

      // Search in Qdrant
      const results = await this.qdrantService.search(embedding, limit, filter);

      // Map results & giải mã content nếu đã mã hóa (bỏ qua nếu chưa mã hóa)
      const documentIds = [
        ...new Set(results.map((h) => h.payload.document_id as string)),
      ];
      const documents =
        documentIds.length > 0
          ? await this.documentRepo.find({
              where: { id: In(documentIds) },
              select: ['id', 'workspace_id'],
            })
          : [];
      const docToWorkspace = new Map(
        documents.map((d) => [d.id, d.workspace_id]),
      );

      const mappedResults = await Promise.all(
        results.map(async (hit) => {
          let content = hit.payload.content as string;
          const documentId = hit.payload.document_id as string;
          const workspaceId = docToWorkspace.get(documentId);
          if (
            workspaceId &&
            content?.startsWith(
              WorkspaceEncryptionService.ENCRYPTED_CONTENT_PREFIX,
            )
          ) {
            try {
              const decrypted =
                await this.workspaceEncryptionService.decryptString(
                  workspaceId,
                  content,
                );
              if (decrypted !== null) content = decrypted;
              // decrypt null: Vault/DEK lỗi → dùng chuỗi rỗng, không poison context
              else content = '';
            } catch {
              content = '';
            }
          }
          return {
            id: hit.id,
            content,
            metadata: hit.payload as Record<string, any>,
            document_id: documentId,
            similarity: hit.score,
          };
        }),
      );

      // Filter by minScore if provided
      if (options?.minScore) {
        return mappedResults.filter((r) => r.similarity >= options.minScore!);
      }

      return mappedResults;
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
