import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { VectorStoreService } from './vector-store.service';
import { randomUUID } from 'crypto';

@Injectable()
export class RagService {
  constructor(
    private openAiService: OpenAiService,
    private vectorStoreService: VectorStoreService,
  ) {}

  async ingest(text: string, metadata: Record<string, any> = {}): Promise<void> {
    const chunks = this.chunkText(text, 1000, 200);

    for (const chunk of chunks) {
      const embedding = await this.openAiService.getEmbedding(chunk);
      await this.vectorStoreService.addDocument({
        id: randomUUID(),
        text: chunk,
        metadata: metadata,
        vector: embedding,
      });
    }
  }

  async ask(question: string): Promise<string> {
    const embedding = await this.openAiService.getEmbedding(question);
    const relevantDocs = await this.vectorStoreService.similaritySearch(embedding);

    const context = relevantDocs.map((doc) => doc.text).join('\n\n');

    return this.openAiService.getChatCompletion(question, context);
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }

    return chunks;
  }
}
