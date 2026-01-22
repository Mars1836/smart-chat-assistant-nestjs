import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VectorStoreService } from './services/vector-store.service';
import { AIStudioService } from '../../common/providers/aistudio';
import { RagEventsService } from './services/rag-events.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectQueue('document-queue') private readonly documentQueue: Queue,
    private readonly vectorStoreService: VectorStoreService,
    private readonly aiStudio: AIStudioService,
    private readonly eventsService: RagEventsService,
  ) {}

  /**
   * Add document to indexing queue
   */
  async indexDocument(documentId: string, filePath: string, mimetype: string, userId: string) {
    await this.documentQueue.add('process-document', {
      documentId,
      filePath,
      mimetype,
      userId,
    });
    
    // Initial event
    this.eventsService.emitProgress({
      documentId,
      status: 'pending',
      progress: 0,
      message: 'Đang chờ xử lý...',
    });
  }

  /**
   * Search for context in specified knowledge bases
   * @param query - Search query
   * @param options - Either workspaceId (search all) or knowledgeIds (search specific)
   * @param limit - Max results
   */
  async search(
    query: string,
    options: { workspaceId?: string; knowledgeIds?: string[] },
    limit = 5,
  ): Promise<string[]> {
    try {
      this.logger.log(`Searching for: ${query}`);

      // 1. Embed query
      const embedding = await this.aiStudio.generateEmbedding(query);

      // 2. Search vectors with knowledge filter
      const results = await this.vectorStoreService.search(embedding, limit, options);

      // 3. Return content
      return results.map((r) => r.content);
    } catch (error) {
      this.logger.error('Error in search:', error);
      return []; // Return empty if search fails, graceful degradation
    }
  }

  /**
   * Search in chatbot's selected knowledge bases
   */
  async searchForChatbot(
    query: string,
    chatbotId: string,
    knowledgeIds: string[],
    limit = 5,
  ): Promise<string[]> {
    if (!knowledgeIds || knowledgeIds.length === 0) {
      this.logger.warn(`Chatbot ${chatbotId} has no knowledge bases linked`);
      return [];
    }
    return this.search(query, { knowledgeIds }, limit);
  }

  /**
   * Retry indexing
   */
  async retryIndex(documentId: string) {
     // Implementation requires retrieving document details from DB.
     // For now, simpler to re-upload or handle in integration layer.
     throw new Error('Not implemented yet'); 
  }

  /**
   * Delete all vectors for a document (from both PostgreSQL and Qdrant)
   */
  async deleteDocumentVectors(documentId: string): Promise<void> {
    this.logger.log(`Deleting vectors for document ${documentId}`);
    await this.vectorStoreService.deleteByDocumentId(documentId);
    this.logger.log(`Vectors deleted for document ${documentId}`);
  }
}
