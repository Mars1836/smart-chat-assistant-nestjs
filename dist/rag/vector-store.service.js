"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStoreService = void 0;
const common_1 = require("@nestjs/common");
let VectorStoreService = class VectorStoreService {
    store = [];
    async addDocument(chunk) {
        this.store.push(chunk);
    }
    async similaritySearch(queryVector, k = 3) {
        if (this.store.length === 0) {
            return [];
        }
        const scoredDocs = this.store.map((doc) => {
            const score = this.cosineSimilarity(queryVector, doc.vector);
            return { doc, score };
        });
        scoredDocs.sort((a, b) => b.score - a.score);
        return scoredDocs.slice(0, k).map((item) => item.doc);
    }
    cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        if (magnitudeA === 0 || magnitudeB === 0)
            return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }
};
exports.VectorStoreService = VectorStoreService;
exports.VectorStoreService = VectorStoreService = __decorate([
    (0, common_1.Injectable)()
], VectorStoreService);
//# sourceMappingURL=vector-store.service.js.map