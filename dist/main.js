"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('./common/utils/logger');
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const app_service_1 = require("./app.service");
const request_context_interceptor_1 = require("./common/interceptors/request-context.interceptor");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const swagger_2 = require("./swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: '*',
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
            const messages = errors.map((error) => {
                return `${error.property}: ${Object.values(error.constraints || {}).join(', ')}`;
            });
            return new common_1.BadRequestException(messages);
        },
    }));
    app.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    app.useGlobalInterceptors(new request_context_interceptor_1.RequestContextInterceptor());
    const document = swagger_1.SwaggerModule.createDocument(app, swagger_2.swaggerConfig);
    swagger_1.SwaggerModule.setup('api', app, document, swagger_2.swaggerOptions);
    const appService = app.get(app_service_1.AppService);
    appService.setApp(app);
    const port = process.env.PORT ?? 3001;
    await app.listen(port);
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
    console.log(`📥 Swagger JSON: http://localhost:${port}/api-json`);
    console.log(`📋 API Schema: http://localhost:${port}/api-schema`);
    console.log(`📦 API Modules: http://localhost:${port}/api-modules`);
}
void bootstrap();
//# sourceMappingURL=main.js.map