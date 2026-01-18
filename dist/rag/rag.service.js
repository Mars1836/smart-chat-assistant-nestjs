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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagService = void 0;
const common_1 = require("@nestjs/common");
const openai_service_1 = require("./openai.service");
const vector_store_service_1 = require("./vector-store.service");
const crypto_1 = require("crypto");
let RagService = class RagService {
    openAiService;
    vectorStoreService;
    constructor(openAiService, vectorStoreService) {
        this.openAiService = openAiService;
        this.vectorStoreService = vectorStoreService;
    }
    async ingest(text, metadata = {}) {
        const chunks = this.chunkText(text, 1000, 200);
        for (const chunk of chunks) {
            const embedding = await this.openAiService.getEmbedding(chunk);
            await this.vectorStoreService.addDocument({
                id: (0, crypto_1.randomUUID)(),
                text: chunk,
                metadata: metadata,
                vector: embedding,
            });
        }
    }
    async ask(question) {
        const embedding = await this.openAiService.getEmbedding(question);
        const relevantDocs = await this.vectorStoreService.similaritySearch(embedding);
        const context = relevantDocs.map((doc) => doc.text).join('\n\n');
        return this.openAiService.getChatCompletion(question, context);
    }
    chunkText(text, chunkSize, overlap) {
        const chunks = [];
        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length);
            chunks.push(text.slice(start, end));
            start += chunkSize - overlap;
        }
        return chunks;
    }
};
exports.RagService = RagService;
exports.RagService = RagService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService,
        vector_store_service_1.VectorStoreService])
], RagService);
//# sourceMappingURL=rag.service.js.map