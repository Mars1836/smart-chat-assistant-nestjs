import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import {
  PaymentListQueryDto,
  PaymentStatsSummaryDto,
  PaymentStatsByDateQueryDto,
  PaymentStatsByDateItemDto,
} from './dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { UsersService } from '../users/users.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Danh sách giao dịch: user xem của mình, admin xem tất cả (có thể lọc user_id).
   */
  async findAll(
    query: PaymentListQueryDto,
    currentUserId: string,
  ): Promise<PaginatedResult<Payment>> {
    const isAdmin = await this.usersService.isAdmin(currentUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy === 'amount' ? 'amount' : 'created_at';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .orderBy(`p.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);

    if (!isAdmin) {
      qb.andWhere('p.user_id = :currentUserId', { currentUserId });
    } else if (query.user_id) {
      qb.andWhere('p.user_id = :userId', { userId: query.user_id });
    }

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.provider) {
      qb.andWhere('p.provider = :provider', { provider: query.provider });
    }

    const [data, total] = await qb.getManyAndCount();
    return createPaginatedResult(data, total, page, limit);
  }

  /**
   * Chi tiết một giao dịch: user xem của mình, admin xem bất kỳ.
   */
  async findOne(id: string, currentUserId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const isAdmin = await this.usersService.isAdmin(currentUserId);
    const paymentUserId = payment.user?.id;
    if (!isAdmin && paymentUserId !== currentUserId) {
      throw new ForbiddenException('Chỉ được xem giao dịch của chính mình');
    }
    return payment;
  }

  /**
   * Thống kê tổng quan: user xem của mình, admin xem toàn hệ thống (có thể lọc user_id qua query sau).
   */
  async getStatsSummary(
    currentUserId: string,
    filterUserId?: string,
  ): Promise<PaymentStatsSummaryDto> {
    const isAdmin = await this.usersService.isAdmin(currentUserId);
    const userId = isAdmin && filterUserId ? filterUserId : currentUserId;
    if (!isAdmin && filterUserId) {
      // User không được filter theo user khác
      throw new ForbiddenException('Forbidden');
    }

    const userWhere = userId ? 'p.user_id = :userId' : '1=1';
    const userParams = userId ? { userId } : {};

    const [
      totalCount,
      totalSuccessAmount,
      byStatusRows,
      byProviderRows,
      last7,
      last30,
    ] = await Promise.all([
      this.paymentRepository
        .createQueryBuilder('p')
        .where(userWhere, userParams)
        .getCount(),
      this.paymentRepository
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .where('p.status = :status', { status: 'success' })
        .andWhere(userWhere, userParams)
        .getRawOne<{ sum: string }>(),
      this.paymentRepository
        .createQueryBuilder('p')
        .select('p.status', 'status')
        .addSelect('COUNT(p.id)', 'count')
        .where(userWhere, userParams)
        .groupBy('p.status')
        .getRawMany<{ status: string; count: string }>(),
      this.paymentRepository
        .createQueryBuilder('p')
        .select('p.provider', 'provider')
        .addSelect('COUNT(p.id)', 'count')
        .where(userWhere, userParams)
        .groupBy('p.provider')
        .getRawMany<{ provider: string; count: string }>(),
      this.paymentRepository
        .createQueryBuilder('p')
        .where('p.status = :status', { status: 'success' })
        .andWhere('p.created_at >= :since', {
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        })
        .andWhere(userWhere, userParams)
        .getCount(),
      this.paymentRepository
        .createQueryBuilder('p')
        .where('p.status = :status', { status: 'success' })
        .andWhere('p.created_at >= :since', {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .andWhere(userWhere, userParams)
        .getCount(),
    ]);

    const by_status: Record<string, number> = {};
    for (const row of byStatusRows) {
      by_status[row.status] = parseInt(row.count, 10);
    }
    const by_provider: Record<string, number> = {};
    for (const row of byProviderRows) {
      by_provider[row.provider] = parseInt(row.count, 10);
    }

    return {
      total_count: totalCount,
      total_amount_success: totalSuccessAmount?.sum ?? '0',
      by_status,
      by_provider,
      success_last_7_days: last7,
      success_last_30_days: last30,
    };
  }

  /**
   * Thống kê giao dịch theo thời gian (số lượng + tổng tiền theo kỳ).
   */
  async getStatsByDate(
    query: PaymentStatsByDateQueryDto,
    currentUserId: string,
  ): Promise<PaymentStatsByDateItemDto[]> {
    const isAdmin = await this.usersService.isAdmin(currentUserId);
    const userId = isAdmin && query.user_id ? query.user_id : currentUserId;
    if (!isAdmin && query.user_id) {
      throw new ForbiddenException('Forbidden');
    }

    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const groupBy = query.groupBy ?? 'day';
    const trunc =
      groupBy === 'month' ? 'month' : groupBy === 'week' ? 'week' : 'day';

    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .select(`date_trunc('${trunc}', p.created_at)::date`, 'date')
      .addSelect('COUNT(p.id)', 'count')
      .addSelect(
        "COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0)",
        'amount',
      )
      .where('p.created_at >= :from', { from })
      .andWhere('p.created_at <= :to', { to })
      .groupBy(`date_trunc('${trunc}', p.created_at)`)
      .orderBy('date', 'ASC');

    if (userId) {
      qb.andWhere('p.user_id = :userId', { userId });
    }

    const rows = await qb.getRawMany<{
      date: Date;
      count: string;
      amount: string;
    }>();

    return rows.map((r) => ({
      date:
        r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : String(r.date).slice(0, 10),
      count: parseInt(r.count, 10),
      amount: r.amount ?? '0',
    }));
  }
}
