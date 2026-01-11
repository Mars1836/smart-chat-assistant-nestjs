"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const swagger_2 = require("./swagger");
let AppService = class AppService {
    app;
    setApp(app) {
        this.app = app;
    }
    getHello() {
        return 'Hello World!';
    }
    getApiJson(module) {
        if (!this.app) {
            throw new Error('Application not initialized');
        }
        const document = swagger_1.SwaggerModule.createDocument(this.app, swagger_2.swaggerConfig);
        if (!module) {
            return document;
        }
        const filteredDocument = {
            ...document,
            paths: {},
            tags: Array.isArray(document.tags) &&
                document.tags.filter((tag) => tag?.name === module),
        };
        const paths = document.paths;
        if (paths) {
            Object.keys(paths).forEach((path) => {
                const pathItem = paths[path];
                const filteredPathItem = {};
                Object.keys(pathItem).forEach((method) => {
                    const lowerMethod = method.toLowerCase();
                    if ([
                        'get',
                        'post',
                        'put',
                        'patch',
                        'delete',
                        'head',
                        'options',
                    ].includes(lowerMethod)) {
                        const operation = pathItem[method];
                        if (operation?.tags && operation.tags.includes(module)) {
                            filteredPathItem[method] = operation;
                        }
                    }
                    else {
                        filteredPathItem[method] = pathItem[method];
                    }
                });
                if (Object.keys(filteredPathItem).length > 0) {
                    filteredDocument.paths[path] =
                        filteredPathItem;
                }
            });
        }
        const components = document.components;
        if (components) {
            filteredDocument.components = { ...components };
            const referencedSchemas = new Set();
            const collectReferences = (obj) => {
                if (!obj || typeof obj !== 'object')
                    return;
                const objRecord = obj;
                if (objRecord.$ref && typeof objRecord.$ref === 'string') {
                    const match = objRecord.$ref.match(/#\/components\/schemas\/(.+)/);
                    if (match) {
                        referencedSchemas.add(match[1]);
                    }
                }
                Object.values(objRecord).forEach((value) => {
                    if (typeof value === 'object') {
                        collectReferences(value);
                    }
                });
            };
            const filteredPaths = filteredDocument.paths;
            if (filteredPaths) {
                Object.values(filteredPaths).forEach((pathItem) => {
                    Object.values(pathItem).forEach((operation) => {
                        if (operation && typeof operation === 'object') {
                            collectReferences(operation);
                        }
                    });
                });
            }
            const schemas = components.schemas;
            if (schemas && filteredDocument.components) {
                const filteredSchemas = {};
                referencedSchemas.forEach((schemaName) => {
                    if (schemas[schemaName]) {
                        filteredSchemas[schemaName] = schemas[schemaName];
                    }
                });
                filteredDocument.components.schemas =
                    filteredSchemas;
            }
        }
        return filteredDocument;
    }
    getModules() {
        if (!this.app) {
            throw new Error('Application not initialized');
        }
        const document = swagger_1.SwaggerModule.createDocument(this.app, swagger_2.swaggerConfig);
        return document.tags?.map((tag) => tag.name) || [];
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)()
], AppService);
//# sourceMappingURL=app.service.js.map