import { Injectable, Logger } from '@nestjs/common';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';
import { ILLMProvider } from '../interfaces/llm-provider.interface';

@Injectable()
export class LLMFactoryService {
  private readonly logger = new Logger(LLMFactoryService.name);

  constructor(
    private readonly geminiProvider: GeminiProvider,
    private readonly openAIProvider: OpenAIProvider,
  ) {}

  getProvider(model: string): ILLMProvider {
    if (model.startsWith('gpt-')) {
      return this.openAIProvider;
    }
    
    // Default to Gemini for models starting with 'gemini-' or others
    return this.geminiProvider;
  }
}
