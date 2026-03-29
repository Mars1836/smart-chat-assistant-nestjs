import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || 'Internal server error',
    };

    // Log all HTTP exceptions to error log with full details
    const logDetails: any = {
      method: errorResponse.method,
      path: errorResponse.path,
      status,
      error: errorResponse.message,
      stack: exception.stack,
    };

    // Include full validation error details if present
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      logDetails.validationErrors = exceptionResponse;
    }

    console.error(
      `[${errorResponse.method}] ${errorResponse.path} - Status: ${status}`,
      logDetails,
    );

    response.status(status).json(errorResponse);
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && (response as any).message) {
        message = (response as any).message;
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    // Prepare detailed log information
    const logDetails: any = {
      method: errorResponse.method,
      path: errorResponse.path,
      status,
      message,
    };

    // Extract full exception details for logging
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      logDetails.stack = exception.stack;

      // Include complete validation error details
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        logDetails.validationErrors = exceptionResponse;
      } else {
        logDetails.error = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      logDetails.exception = {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      };
    } else {
      logDetails.exception = exception;
    }

    // Log all exceptions to error log
    console.error(
      `[${errorResponse.method}] ${errorResponse.path} - Status: ${status}`,
      logDetails,
    );

    response.status(status).json(errorResponse);
  }
}
