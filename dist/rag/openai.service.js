"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = __importDefault(require("openai"));
let OpenAiService = class OpenAiService {
    configService;
    openai;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const apiKey = this.configService.get('OPENAI_API_KEY');
        if (!apiKey) {
            console.warn('OPENAI_API_KEY is not defined. RAG features will not work.');
        }
        this.openai = new openai_1.default({
            apiKey: apiKey,
        });
    }
    async getEmbedding(text) {
        if (!text) {
            throw new Error('Text is required for embedding');
        }
        const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
        });
        return response.data[0].embedding;
    }
    async getChatCompletion(prompt, context) {
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful assistant. Use the provided context to answer the user request. If the context does not contain the answer, say "I do not have enough information."',
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
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OpenAiService);
//# sourceMappingURL=openai.service.js.map