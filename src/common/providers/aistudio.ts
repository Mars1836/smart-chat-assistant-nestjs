import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GeminiRequest {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: any[];
  }>;
  promptFeedback?: {
    safetyRatings: any[];
  };
}

@Injectable()
export class AIStudioService {
  private readonly logger = new Logger(AIStudioService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GOOGLE_AI_STUDIO_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn(
        'GOOGLE_AI_STUDIO_API_KEY is not set. AI features will not work.',
      );
    } else {
      this.logger.log(
        `Google AI Studio initialized with API key: ${this.apiKey.substring(0, 10)}...`,
      );
    }
  }

  /**
   * Gọi Gemini API để generate response
   */
  async generateResponse(
    model: string,
    prompt: string,
    config?: {
      temperature?: number;
      maxTokens?: number;
      systemInstruction?: string;
    },
  ): Promise<string> {
    try {
      const messages: GeminiMessage[] = [];

      // Nếu có system instruction, thêm vào đầu
      if (config?.systemInstruction) {
        messages.push({
          role: 'user',
          parts: [{ text: `[System]: ${config.systemInstruction}` }],
        });
        messages.push({
          role: 'model',
          parts: [{ text: 'Understood. I will follow these instructions.' }],
        });
      }

      // Thêm user prompt
      messages.push({
        role: 'user',
        parts: [{ text: prompt }],
      });

      const requestBody: GeminiRequest = {
        contents: messages,
        generationConfig: {
          temperature: config?.temperature ?? 0.7,
          maxOutputTokens: config?.maxTokens ?? 1000,
          topP: 0.95,
          topK: 40,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Gemini API error: ${error}`);
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      const text = data.candidates[0].content.parts[0].text;
      return text;
    } catch (error) {
      this.logger.error('Error calling Gemini API:', error);
      throw error;
    }
  }

  /**
   * Chat với context (multi-turn conversation)
   */
  async chat(
    model: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    config?: {
      temperature?: number;
      maxTokens?: number;
      systemInstruction?: string;
    },
  ): Promise<string> {
    try {
      const geminiMessages: GeminiMessage[] = [];

      // System instruction
      if (config?.systemInstruction) {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: `[System]: ${config.systemInstruction}` }],
        });
        geminiMessages.push({
          role: 'model',
          parts: [{ text: 'Understood.' }],
        });
      }

      // Convert messages
      for (const msg of messages) {
        geminiMessages.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }

      const requestBody: GeminiRequest = {
        contents: geminiMessages,
        generationConfig: {
          temperature: config?.temperature ?? 0.7,
          maxOutputTokens: config?.maxTokens ?? 1000,
          topP: 0.95,
          topK: 40,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      this.logger.error('Error in chat:', error);
      throw error;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      // Remove "models/" prefix from model names
      return data.models?.map((m) => m.name.replace('models/', '')) ?? [];
    } catch (error) {
      this.logger.error('Error listing models:', error);
      return [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
      ];
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.generateResponse(
        'gemini-2.0-flash-lite',
        'Hello',
        { maxTokens: 10 },
      );
      return !!response;
    } catch {
      return false;
    }
  }
}
