import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ILLMProvider,
  LLMConfig,
  LLMMessage,
  LLMResponse,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenAIProvider implements ILLMProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set. OpenAI features will not work.');
    }
    this.client = new OpenAI({
      apiKey: apiKey,
    });
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
      const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // 1. System Instruction
      if (config?.systemInstruction) {
        openAIMessages.push({
          role: 'system',
          content: config.systemInstruction,
        });
      }

      // 2. Map messages
      for (const msg of messages) {
        if (msg.role === 'function') {
          // OpenAI expects tool outputs with role 'tool'
          openAIMessages.push({
            role: 'tool',
            tool_call_id: msg.name || 'unknown_call_id', // Orchestrator might need to store call_id
            content: JSON.stringify(msg.functionResponse?.response),
          } as any);
        } else if (msg.role === 'assistant') {
          if (msg.functionCall) {
            openAIMessages.push({
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_' + msg.functionCall.name + '_' + Date.now(), // Fake ID if not stored
                  type: 'function',
                  function: {
                    name: msg.functionCall.name,
                    arguments: JSON.stringify(msg.functionCall.args),
                  },
                },
              ],
            });
          } else {
            openAIMessages.push({
              role: 'assistant',
              content: msg.content || '',
            });
          }
        } else if (msg.role === 'system') {
           openAIMessages.push({ role: 'system', content: msg.content || '' });
        } else {
          // User
          openAIMessages.push({ role: 'user', content: msg.content || '' });
        }
      }

      // 3. Tools
      let tools: OpenAI.Chat.ChatCompletionTool[] | undefined;
      if (config?.tools && config.tools.length > 0) {
        tools = config.tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
      }

      const response = await this.client.chat.completions.create({
        model: model, // e.g., "gpt-3.5-turbo", "gpt-4o"
        messages: openAIMessages,
        temperature: config?.temperature,
        max_tokens: config?.maxTokens,
        tools: tools,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Map back to LLMResponse
      if (message.tool_calls && message.tool_calls.length > 0) {
        return {
          functionCalls: message.tool_calls.map((tc: any) => ({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          })),
        };
      }

      return {
        text: message.content || undefined,
      };
    } catch (error) {
      this.logger.error('Error calling OpenAI API', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Error generating embedding with OpenAI', error);
      throw error;
    }
  }
}
