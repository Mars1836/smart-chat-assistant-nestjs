// Initialize logger first (must be at the top)
require('./common/utils/logger');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { formatValidationErrors } from './common/utils/format-validation-errors';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppService } from './app.service';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { swaggerConfig, swaggerOptions } from './swagger';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());

  const corsOriginsEnv = process.env.CORS_ORIGIN?.trim();
  const corsOrigin =
    corsOriginsEnv && corsOriginsEnv.length > 0
      ? corsOriginsEnv.split(',').map((o) => o.trim())
      : true;

  const allowedCorsHeaders = [
    'Content-Type',
    'Authorization',
    'X-Client-Type',
    'Accept',
    'X-Widget-Key',
  ].join(', ');

  app.enableCors({
    // Keep global CORS policy for non-widget APIs.
    // Widget public endpoints apply their own per-chatbot origin checks in controller/service.
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    // Let OPTIONS continue to route handlers so widget endpoints can set CORS
    // headers dynamically from chatbot widget config (allowed_origins, api key, ...).
    preflightContinue: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Client-Type',
      'Accept',
      'X-Widget-Key',
    ],
  });

  // With preflightContinue: true, OPTIONS is not auto-answered — routes without @Options()
  // (e.g. /auth/*, /workspaces, …) would 404 on preflight. Answer allowed-origin OPTIONS here.
  // Skip /public/widget/* so WidgetController can set per-chatbot CORS on @Options handlers.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'OPTIONS') {
      return next();
    }
    const p = req.path || '';
    if (p.startsWith('/public/widget')) {
      return next();
    }
    const requestOrigin = req.headers.origin;
    let reflectOrigin: string | undefined;
    if (Array.isArray(corsOrigin)) {
      if (
        typeof requestOrigin === 'string' &&
        corsOrigin.includes(requestOrigin)
      ) {
        reflectOrigin = requestOrigin;
      }
    } else {
      // origin: true in cors — mirror requesting origin for credentialed responses
      reflectOrigin =
        typeof requestOrigin === 'string' ? requestOrigin : undefined;
    }
    if (!reflectOrigin) {
      return next();
    }
    const reqHdr = req.headers['access-control-request-headers'];
    res.setHeader('Access-Control-Allow-Origin', reflectOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      typeof reqHdr === 'string' && reqHdr.length > 0 ? reqHdr : allowedCorsHeaders,
    );
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages = formatValidationErrors(errors);
        return new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: messages.length ? messages : ['Validation failed'],
        });
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
