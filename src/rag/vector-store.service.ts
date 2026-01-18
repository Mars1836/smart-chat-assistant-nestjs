import { Injectable } from '@nestjs/common';

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: Record<string, any>;
  vector: number[];
}

@Injectable()
export class VectorStoreService {
  // In-memory store for demonstration.
  // In a real production app, this should be replaced by PGVector, Qdrant, Pinecone, etc.
  private store: DocumentChunk[] = [];

  async addDocument(chunk: DocumentChunk): Promise<void> {
    this.store.push(chunk);
  }

  async similaritySearch(queryVector: number[], k: number = 3): Promise<DocumentChunk[]> {
    if (this.store.length === 0) {
      return [];
    }

    const scoredDocs = this.store.map((doc) => {
      const score = this.cosineSimilarity(queryVector, doc.vector);
      return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);

    return scoredDocs.slice(0, k).map((item) => item.doc);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
