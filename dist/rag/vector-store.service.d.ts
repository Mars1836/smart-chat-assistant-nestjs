export interface DocumentChunk {
    id: string;
    text: string;
    metadata: Record<string, any>;
    vector: number[];
}
export declare class VectorStoreService {
    private store;
    addDocument(chunk: DocumentChunk): Promise<void>;
    similaritySearch(queryVector: number[], k?: number): Promise<DocumentChunk[]>;
    private cosineSimilarity;
}
