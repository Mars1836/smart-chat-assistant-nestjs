import {
  Repository,
  FindManyOptions,
  FindOptionsOrder,
  ObjectLiteral,
} from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginatedResult } from '../interfaces/pagination.interface';
import { createPaginatedResult } from '../utils/pagination.util';

/**
 * Base service với các method hỗ trợ pagination
 */
export abstract class BaseService<T extends ObjectLiteral> {
  /**
   * Lấy repository (cần override trong service con)
   */
  protected abstract getRepository(): Repository<T>;

  /**
   * Paginate query với default options
   */
  async paginate(
    pagination: PaginationDto,
    additionalOptions?: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'>,
  ): Promise<PaginatedResult<T>> {
    const repository = this.getRepository();
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build order options
    const order: FindOptionsOrder<T> = {} as FindOptionsOrder<T>;
    if (pagination.sortBy) {
      (order as Record<string, 'ASC' | 'DESC'>)[pagination.sortBy] =
        pagination.sortOrder ?? 'ASC';
    }

    // Execute query with pagination
    const [data, total] = await repository.findAndCount({
      ...additionalOptions,
      skip,
      take: limit,
      order: Object.keys(order).length > 0 ? order : undefined,
    });

    return createPaginatedResult(data, total, page, limit);
  }

  /**
   * Lấy tất cả với pagination
   * Note: Service con có thể override method này với signature riêng
   */
  async findAllPaginated(
    pagination: PaginationDto,
  ): Promise<PaginatedResult<T>> {
    return this.paginate(pagination);
  }
}
