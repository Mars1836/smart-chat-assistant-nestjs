import { OpenAiService } from './openai.service';
import { VectorStoreService } from './vector-store.service';
export declare class RagService {
    private openAiService;
    private vectorStoreService;
    constructor(openAiService: OpenAiService, vectorStoreService: VectorStoreService);
    ingest(text: string, metadata?: Record<string, any>): Promise<void>;
    ask(question: string): Promise<string>;
    private chunkText;
}
