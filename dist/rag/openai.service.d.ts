import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class OpenAiService implements OnModuleInit {
    private configService;
    private openai;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    getEmbedding(text: string): Promise<number[]>;
    getChatCompletion(prompt: string, context?: string): Promise<string>;
}
