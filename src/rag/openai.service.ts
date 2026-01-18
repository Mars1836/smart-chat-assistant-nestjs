import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService implements OnModuleInit {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      console.warn('OPENAI_API_KEY is not defined. RAG features will not work.');
    }
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!text) {
      throw new Error('Text is required for embedding');
    }
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async getChatCompletion(prompt: string, context?: string): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Use the provided context to answer the user request. If the context does not contain the answer, say "I do not have enough information."',
      },
    ];

    if (context) {
      messages.push({
        role: 'system',
        content: `Context:\n${context}`,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
    });

    return response.choices[0].message.content || '';
  }
}
