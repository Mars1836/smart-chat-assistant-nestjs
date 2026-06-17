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
      this.logger.warn(
        'OPENAI_API_KEY is not set. OpenAI features will not work.',
      );
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
          // These are historical tool results from the orchestrator graph.
          // Send them as normal context; OpenAI's role=tool is only valid
          // immediately after an assistant message with matching tool_calls.
          openAIMessages.push({
            role: 'user',
            content: [
              `[Tool result: ${msg.functionResponse?.name ?? msg.name ?? 'unknown'}]`,
              JSON.stringify(msg.functionResponse?.response ?? null),
            ].join('\n'),
          });
        } else if (msg.role === 'assistant') {
          if (msg.functionCall) {
            openAIMessages.push({
              role: 'assistant',
              content: [
                `[Tool call requested: ${msg.functionCall.name}]`,
                JSON.stringify(msg.functionCall.args ?? {}),
              ].join('\n'),
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
          if (msg.images?.length) {
            openAIMessages.push({
              role: 'user',
              content: [
                { type: 'text', text: msg.content || 'Analyze the image.' },
                ...msg.images.map((image) => ({
                  type: 'image_url' as const,
                  image_url: {
                    url: `data:${image.mimeType};base64,${image.data}`,
                  },
                })),
              ],
            } as any);
          } else {
            openAIMessages.push({ role: 'user', content: msg.content || '' });
          }
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
          usage: response.usage
            ? {
                input_tokens: response.usage.prompt_tokens || 0,
                output_tokens: response.usage.completion_tokens || 0,
              }
            : undefined,
        };
      }

      return {
        text: message.content || undefined,
        usage: response.usage
          ? {
              input_tokens: response.usage.prompt_tokens || 0,
              output_tokens: response.usage.completion_tokens || 0,
            }
          : undefined,
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
