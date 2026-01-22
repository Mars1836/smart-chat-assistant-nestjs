import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string; // base64 encoded
  };
}

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: GeminiPart[];
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
   * Generate embedding for text
   */
  async generateEmbedding(text: string, model = 'text-embedding-004'): Promise<number[]> {
    try {
      const requestBody = {
        content: {
          parts: [{ text }],
        },
      };

      const response = await fetch(
        `${this.baseUrl}/models/${model}:embedContent?key=${this.apiKey}`,
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
        throw new Error(`Gemini Embedding API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as { embedding: { values: number[] } };

      if (!data.embedding || !data.embedding.values) {
        throw new Error('No embedding returned from Gemini API');
      }

      return data.embedding.values;
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Extract text/information from image using Gemini Vision
   * @param imageBuffer - Image file buffer
   * @param mimeType - Image MIME type (image/png, image/jpeg, etc.)
   * @param prompt - Optional custom prompt for extraction
   */
  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    prompt?: string,
  ): Promise<string> {
    try {
      const base64Image = imageBuffer.toString('base64');

      const defaultPrompt = `Analyze this image and extract ALL text content you can see. 
If the image contains a document, extract all the text maintaining the structure.
If it's a diagram or chart, describe the content and any text labels.
If there's handwritten text, transcribe it as accurately as possible.
Provide the extracted content in a clear, organized format.`;

      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
              {
                text: prompt || defaultPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for accurate extraction
          maxOutputTokens: 4096,
        },
      };

      // Use a vision-capable model
      const model = 'gemini-2.0-flash';

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
        this.logger.error(`Gemini Vision API error: ${error}`);
        throw new Error(`Gemini Vision API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini Vision API');
      }

      return data.candidates[0].content.parts[0].text || '';
    } catch (error) {
      this.logger.error('Error extracting from image:', error);
      throw error;
    }
  }

  /**
   * Describe image content for RAG indexing
   */
  async describeImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    const prompt = `Describe this image in detail for a knowledge base. Include:
1. Main subject/content of the image
2. Any text visible in the image (OCR)
3. Key visual elements and their relationships
4. Context and meaning (if inferable)

Format the description in a way that would be useful for text search and retrieval.`;

    return this.extractFromImage(imageBuffer, mimeType, prompt);
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
