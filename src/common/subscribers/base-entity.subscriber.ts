import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { AsyncLocalStorage } from 'async_hooks';
import { BaseEntity } from '../entities/base.entity';

interface RequestContext {
  userId: string | null;
}

/**
 * TypeORM Subscriber để tự động thêm created_by_id khi insert entity
 * Chỉ áp dụng cho entities extend BaseEntity
 */
@EventSubscriber()
export class BaseEntitySubscriber implements EntitySubscriberInterface {
  /**
   * Tự động thêm created_by_id trước khi insert
   * Lấy userId từ AsyncLocalStorage (được set bởi RequestContextInterceptor)
   */
  beforeInsert(event: InsertEvent<BaseEntity>): void {
    // Chỉ set nếu chưa có created_by_id
    if (event.entity.created_by_id) {
      return;
    }

    // Lấy userId từ AsyncLocalStorage
    const userId = this.getUserIdFromContext();

    if (userId) {
      event.entity.created_by_id = userId;
    }
  }

  /**
   * Lấy userId từ AsyncLocalStorage context
   */
  private getUserIdFromContext(): string | null {
    try {
      // Access global AsyncLocalStorage instance
      const requestContext = global.__REQUEST_CONTEXT__ as
        | AsyncLocalStorage<RequestContext>
        | undefined;
      if (requestContext) {
        const context = requestContext.getStore();
        return context?.userId || null;
      }
    } catch {
      // AsyncLocalStorage not available or no context
    }

    return null;
  }
}
