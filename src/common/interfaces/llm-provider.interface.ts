export interface LLMMessage {
  role: 'user' | 'assistant' | 'function' | 'system';
  content?: string;
  images?: Array<{
    mimeType: string;
    data: string;
  }>;
  name?: string; // For function/tool responses
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

export interface LLMTool_FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: 'object' | 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  tools?: LLMTool_FunctionDeclaration[];
}

export interface LLMResponse {
  text?: string;
  functionCalls?: Array<{
    name: string;
    args: any;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ILLMProvider {
  /**
   * Single turn generation
   */
  generateResponse(
    model: string,
    prompt: string,
    config?: LLMConfig,
  ): Promise<LLMResponse>;

  /**
   * Multi-turn chat
   */
  chat(
    model: string,
    messages: LLMMessage[],
    config?: LLMConfig,
  ): Promise<LLMResponse>;

  /**
   * Generate vector embedding
   */
  generateEmbedding(text: string): Promise<number[]>;
}
