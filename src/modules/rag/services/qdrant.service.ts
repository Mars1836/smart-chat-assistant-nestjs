import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private readonly collectionName = 'document_vectors';
  private readonly vectorSize = 3072; // gemini-embedding-001 dimension

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('QDRANT_URL') ?? 'http://localhost:6333';
    const apiKey = this.configService.get<string>('QDRANT_API_KEY');

    this.client = new QdrantClient({
      url,
      apiKey,
    });

    // Tạo collection nếu chưa tồn tại
    await this.ensureCollection();
  }

  /**
   * Đảm bảo collection tồn tại
   */
  private async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine', // Cosine similarity for text embeddings
          },
        });
        this.logger.log(`✅ Qdrant collection '${this.collectionName}' created`);
      } else {
        this.logger.log(`✅ Qdrant collection '${this.collectionName}' already exists`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to ensure Qdrant collection:`, error);
      throw error;
    }
  }

  /**
   * Lưu vector vào Qdrant
   */
  async upsertPoint(
    pointId: string,
    vector: number[],
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: pointId,
            vector,
            payload,
          },
        ],
      });
    } catch (error) {
      this.logger.error(`Error upserting point ${pointId}:`, error);
      throw error;
    }
  }

  /**
   * Tìm kiếm vectors tương tự
   */
  async search(
    queryVector: number[],
    limit: number = 5,
    filter?: Record<string, any>,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, any> }>> {
    try {
      const result = await this.client.search(this.collectionName, {
        vector: queryVector,
        limit,
        filter,
        with_payload: true,
      });

      return result.map((hit) => ({
        id: hit.id as string,
        score: hit.score,
        payload: hit.payload || {},
      }));
    } catch (error) {
      this.logger.error('Error searching vectors:', error);
      throw error;
    }
  }

  /**
   * Xóa points theo filter
   */
  async deletePoints(filter: Record<string, any>): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        filter: {
          must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
          })),
        },
      });
    } catch (error) {
      this.logger.error('Error deleting points:', error);
      throw error;
    }
  }

  /**
   * Xóa tất cả points của một document
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.deletePoints({ document_id: documentId });
  }

  /**
   * Get client instance (nếu cần dùng trực tiếp)
   */
  getClient(): QdrantClient {
    return this.client;
  }
}
