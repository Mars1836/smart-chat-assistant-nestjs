import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { RagService } from '../rag/rag.service';
export declare class DocumentsService {
    private documentsRepository;
    private ragService;
    constructor(documentsRepository: Repository<Document>, ragService: RagService);
    processDocument(documentId: string, content: string): Promise<void>;
}
