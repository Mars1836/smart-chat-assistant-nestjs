import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UserStatsSummaryDto,
  UserStatsByDateQueryDto,
  UserStatsByDateItemDto,
} from './dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { BaseService } from '../../common/services/base.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  protected getRepository(): Repository<User> {
    return this.userRepository;
  }

  /**
   * Tạo user mới (chỉ admin)
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Kiểm tra email đã tồn tại
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password nếu có
    let hashedPassword: string | null = null;
    if (createUserDto.password) {
      const saltRounds =
        this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
      hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);
    }

    // Tạo user
    // created_by_id sẽ được tự động thêm bởi BaseEntitySubscriber
    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password: hashedPassword,
      google_id: createUserDto.google_id ?? null,
      avatar_url: createUserDto.avatar_url ?? null,
      language: createUserDto.language ?? 'vi',
      system_role_id: createUserDto.system_role_id ?? null,
    });

    return await this.userRepository.save(user);
  }

  /**
   * Lấy danh sách users (có phân trang)
   */
  async findAll(pagination: PaginationDto): Promise<PaginatedResult<User>> {
    // Set default sort if not provided
    if (!pagination.sortBy) {
      pagination.sortBy = 'created_at';
      pagination.sortOrder = 'DESC';
    }

    return this.paginate(pagination, {
      relations: ['systemRole'],
    });
  }

  /**
   * Lấy profile của user hiện tại
   */
  async getProfile(userId: string): Promise<User> {
    return this.findOne(userId);
  }

  /**
   * Lấy thông tin chi tiết user. Nếu xem user khác (userId !== currentUserId) thì chỉ admin mới được.
   */
  async findOne(userId: string, currentUserId?: string): Promise<User> {
    if (currentUserId && currentUserId !== userId) {
      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
        relations: ['systemRole'],
      });
      if (currentUser?.systemRole?.name !== 'admin') {
        throw new ForbiddenException(
          'Chỉ quản trị viên mới được xem thông tin user khác',
        );
      }
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['systemRole'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Kiểm tra user có phải admin hệ thống không
   */
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['systemRole'],
    });
    return user?.systemRole?.name === 'admin';
  }

  /**
   * Lấy user theo email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['systemRole'],
    });
  }

  /**
   * Cập nhật user. Cập nhật user khác (userId !== currentUserId) chỉ dành cho admin.
   */
  async update(
    userId: string,
    updateUserDto: UpdateUserDto,
    currentUserId?: string,
  ): Promise<User> {
    // findOne đã kiểm tra: xem/sửa user khác chỉ admin
    const user = await this.findOne(userId, currentUserId);

    // Hash password nếu có
    if (updateUserDto.password) {
      const saltRounds =
        this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
      user.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    // Cập nhật các field khác
    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }
    if (updateUserDto.email !== undefined) {
      // Kiểm tra email đã tồn tại (nếu thay đổi email)
      if (updateUserDto.email !== user.email) {
        const existingUser = await this.findByEmail(updateUserDto.email);
        if (existingUser) {
          throw new ConflictException('Email already exists');
        }
        user.email = updateUserDto.email;
      }
    }
    if (updateUserDto.avatar_url !== undefined) {
      user.avatar_url = updateUserDto.avatar_url;
    }
    if (updateUserDto.language !== undefined) {
      user.language = updateUserDto.language;
    }
    if (updateUserDto.system_role_id !== undefined) {
      user.system_role_id = updateUserDto.system_role_id;
    }

    return await this.userRepository.save(user);
  }

  /**
   * Xóa user. Không cho xóa chính mình. Xóa user khác chỉ dành cho admin.
   */
  async remove(userId: string, currentUserId?: string): Promise<void> {
    if (currentUserId && currentUserId === userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['systemRole'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (currentUserId && currentUserId !== userId) {
      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
        relations: ['systemRole'],
      });
      if (currentUser?.systemRole?.name !== 'admin') {
        throw new ForbiddenException(
          'Chỉ quản trị viên mới được xóa user khác',
        );
      }
    }

    await this.userRepository.remove(user);
  }

  /**
   * Thống kê tổng quan user (chỉ admin).
   */
  async getStatsSummary(): Promise<UserStatsSummaryDto> {
    const [total, byRoleRows, newLast7, newLast30] = await Promise.all([
      this.userRepository.count(),
      this.userRepository
        .createQueryBuilder('u')
        .select('r.name', 'roleName')
        .addSelect('COUNT(u.id)', 'count')
        .leftJoin('u.systemRole', 'r')
        .groupBy('r.name')
        .getRawMany<{ roleName: string | null; count: string }>(),
      this.userRepository
        .createQueryBuilder('u')
        .where('u.created_at >= :since', {
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        })
        .getCount(),
      this.userRepository
        .createQueryBuilder('u')
        .where('u.created_at >= :since', {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .getCount(),
    ]);

    const by_role: Record<string, number> = {};
    for (const row of byRoleRows) {
      const key = row.roleName ?? 'no_role';
      by_role[key] = parseInt(row.count, 10);
    }

    return {
      total,
      by_role,
      new_last_7_days: newLast7,
      new_last_30_days: newLast30,
    };
  }

  /**
   * Thống kê số user tạo mới theo từng kỳ (day/week/month) trong khoảng from–to (chỉ admin).
   */
  async getStatsByDate(
    query: UserStatsByDateQueryDto,
  ): Promise<UserStatsByDateItemDto[]> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const groupBy = query.groupBy ?? 'day';

    const trunc = groupBy === 'month' ? 'month' : groupBy === 'week' ? 'week' : 'day';
    const qb = this.userRepository
      .createQueryBuilder('u')
      .select(`date_trunc('${trunc}', u.created_at)::date`, 'date')
      .addSelect('COUNT(u.id)', 'count')
      .where('u.created_at >= :from', { from })
      .andWhere('u.created_at <= :to', { to })
      .groupBy(`date_trunc('${trunc}', u.created_at)`)
      .orderBy('date', 'ASC');

    const rows = await qb.getRawMany<{ date: Date; count: string }>();

    return rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      count: parseInt(r.count, 10),
    }));
  }
}
