import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  ILLMProvider,
  LLMConfig,
  LLMMessage,
  LLMResponse,
} from '../interfaces/llm-provider.interface';

// Keep internal interfaces if needed for direct API mapping
interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: any };
  functionResponse?: { name: string; response: any };
}

interface GeminiMessage {
  role: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

@Injectable()
export class GeminiProvider implements ILLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly genAI: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GOOGLE_AI_STUDIO_API_KEY') ?? '';

    if (!this.apiKey) {
      this.logger.warn(
        'GOOGLE_AI_STUDIO_API_KEY is not set. Gemini features will not work.',
      );
    }

    this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generateResponse(
    model: string,
    prompt: string,
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
    return this.chat(model, messages, config);
  }

  async chat(
    model: string,
    messages: LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse> {
    try {
      const geminiMessages: GeminiMessage[] = [];

      // 1. System Instruction
      if (config?.systemInstruction) {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: `[System Instructions]: ${config.systemInstruction}` }],
        });
        geminiMessages.push({
          role: 'model',
          parts: [{ text: 'Understood.' }],
        });
      }

      // 2. Map messages (Gemini API only accepts role 'user' or 'model'; function response goes as 'user')
      for (const msg of messages) {
        if (msg.role === 'function' && msg.functionResponse) {
          // Gemini expects response to be an object (Struct), not an array or primitive
          const raw = msg.functionResponse.response;
          const response =
            raw !== null && typeof raw === 'object' && !Array.isArray(raw)
              ? raw
              : { result: raw };

          geminiMessages.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: msg.functionResponse.name,
                  response,
                },
              },
            ],
          });
        } else if (msg.role === 'assistant') {
          const parts: GeminiPart[] = [];
          if (msg.content) parts.push({ text: msg.content });
          if (msg.functionCall)
            parts.push({
              functionCall: {
                name: msg.functionCall.name,
                args: msg.functionCall.args,
              },
            });
          if (parts.length > 0) {
            geminiMessages.push({ role: 'model', parts });
          }
        } else {
          // USER or SYSTEM: must have at least one non-empty part (Gemini rejects empty parts)
          const text = (msg.content && String(msg.content).trim()) || ' ';
          geminiMessages.push({
            role: 'user',
            parts: [{ text }],
          });
        }
      }

      if (geminiMessages.length === 0) {
        throw new Error(
          'Gemini API requires at least one content with parts. No valid messages to send.',
        );
      }

      const requestBody: any = {
        contents: geminiMessages,
        generationConfig: {
          temperature: config?.temperature ?? 0.7,
          maxOutputTokens: config?.maxTokens ?? 1000,
          topP: 0.95,
          topK: 40,
        },
      };

      if (config?.tools && config.tools.length > 0) {
        requestBody.tools = [{ function_declarations: config.tools }];
      }

      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini API');
      }

      const candidate = data.candidates[0];
      const parts = candidate.content?.parts || [];

      const functionCalls = parts
        .filter((p: any) => p.functionCall)
        .map((p: any) => p.functionCall);

      const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
      const text = textParts.length > 0 ? textParts.join('\n') : undefined;

      const usageMeta = (data as any).usageMetadata;

      return {
        text,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        usage: usageMeta
          ? {
              input_tokens: usageMeta.promptTokenCount || 0,
              output_tokens:
                (usageMeta.candidatesTokenCount || 0) +
                (usageMeta.totalTokenCount
                  ? usageMeta.totalTokenCount - usageMeta.promptTokenCount
                  : 0),
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error('Error in Gemini chat:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use gemini-embedding-001 via SDK (3072 dimensions, high quality)
      const response = await this.genAI.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: {
          taskType: 'SEMANTIC_SIMILARITY',
        },
      });

      if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error('No embeddings returned from Gemini API');
      }

      return response.embeddings[0].values as number[];
    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Extract text/information from image using Gemini Vision
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
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      };

      const model = 'gemini-2.0-flash';
      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini Vision API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from Gemini Vision API');
      }

      return data.candidates[0].content.parts[0].text || '';
    } catch (error) {
      this.logger.error('Error extracting from image:', error);
      throw error;
    }
  }

  async describeImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    const prompt = `Describe this image in detail for a knowledge base. Include:
1. Main subject/content of the image
2. Any text visible in the image (OCR)
3. Key visual elements and their relationships
4. Context and meaning (if inferable)

Format the description in a way that would be useful for text search and retrieval.`;

    return this.extractFromImage(imageBuffer, mimeType, prompt);
  }

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

  async listModels(): Promise<string[]> {
      // const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      // if (!response.ok) {
      //   throw new Error(`Failed to list models: ${response.status}`);
      // }
      // const data = (await response.json()) as { models?: Array<{ name: string }> };
      const allowedModels = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
      ];

      return allowedModels;
    }
  
}
