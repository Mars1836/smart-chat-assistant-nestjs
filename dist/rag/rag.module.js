"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_service_1 = require("./openai.service");
const vector_store_service_1 = require("./vector-store.service");
const rag_service_1 = require("./rag.service");
const rag_controller_1 = require("./rag.controller");
let RagModule = class RagModule {
};
exports.RagModule = RagModule;
exports.RagModule = RagModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [openai_service_1.OpenAiService, vector_store_service_1.VectorStoreService, rag_service_1.RagService],
        controllers: [rag_controller_1.RagController],
        exports: [openai_service_1.OpenAiService, vector_store_service_1.VectorStoreService, rag_service_1.RagService],
    })
], RagModule);
//# sourceMappingURL=rag.module.js.map