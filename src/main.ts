// Initialize logger first (must be at the top)
require('./common/utils/logger');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { swaggerConfig, swaggerOptions } from './swagger';
import * as path from 'path';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  const corsOriginsEnv = process.env.CORS_ORIGIN?.trim();
  const corsOrigin =
    corsOriginsEnv && corsOriginsEnv.length > 0
      ? corsOriginsEnv.split(',').map((o) => o.trim())
      : true;

  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: '*',
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return `${error.property}: ${Object.values(error.constraints || {}).join(', ')}`;
        });
        return new BadRequestException(messages);
      },
    }),
  );

  // Global exception filter để log tất cả errors
  app.useGlobalFilters(new AllExceptionsFilter());

  // Request context interceptor để lưu userId vào AsyncLocalStorage
  app.useGlobalInterceptors(new RequestContextInterceptor());

  // Swagger Configuration
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, swaggerOptions);

  // Initialize AppService with app reference for API schema endpoint
  const appService = app.get(AppService);
  appService.setApp(app);

  // Use port 3001 to avoid conflict with Next.js
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
  console.log(`📥 Swagger JSON: http://localhost:${port}/api-json`);
  console.log(`📋 API Schema: http://localhost:${port}/api-schema`);
  console.log(`📦 API Modules: http://localhost:${port}/api-modules`);
}

void bootstrap();
