import { RagService } from './rag.service';
export declare class RagController {
    private readonly ragService;
    constructor(ragService: RagService);
    ingest(body: {
        text: string;
        metadata?: any;
    }): Promise<{
        success: boolean;
    }>;
    ask(body: {
        question: string;
    }): Promise<{
        answer: string;
    }>;
}
