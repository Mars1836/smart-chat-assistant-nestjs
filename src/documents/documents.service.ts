import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { RagService } from '../rag/rag.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private ragService: RagService,
  ) {}

  async processDocument(documentId: string, content: string): Promise<void> {
    const document = await this.documentsRepository.findOneBy({ id: documentId });
    if (!document) {
      throw new Error('Document not found');
    }

    // Ingest content into RAG system
    await this.ragService.ingest(content, { documentId });

    // Update document status or metadata if needed
    // For now, we assume successful ingestion means we are good.
    // In a real app, we might store the vector ID (or IDs) here.
  }
}
