import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId: string | null;
}

// Create global AsyncLocalStorage instance
declare global {
  var __REQUEST_CONTEXT__: AsyncLocalStorage<RequestContext> | undefined;
}

if (!global.__REQUEST_CONTEXT__) {
  global.__REQUEST_CONTEXT__ = new AsyncLocalStorage<RequestContext>();
}

/**
 * Interceptor để lưu userId vào AsyncLocalStorage
 * Cho phép TypeORM Subscriber truy cập userId từ bất kỳ đâu trong request lifecycle
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  private readonly asyncLocalStorage = global.__REQUEST_CONTEXT__!;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string };
    }>();
    const user = request.user;
    const userId = user?.sub || null;

    // Store userId in AsyncLocalStorage
    return new Observable((subscriber) => {
      this.asyncLocalStorage.run({ userId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
