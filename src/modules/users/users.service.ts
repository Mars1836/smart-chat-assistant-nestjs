import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto';
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
   * Lấy thông tin chi tiết user
   */
  async findOne(userId: string): Promise<User> {
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
   * Lấy user theo email
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['systemRole'],
    });
  }

  /**
   * Cập nhật user
   */
  async update(
    userId: string,
    updateUserDto: UpdateUserDto,
    currentUserId?: string,
  ): Promise<User> {
    const user = await this.findOne(userId);

    // Kiểm tra quyền: chỉ có thể update chính mình, trừ khi là admin
    if (currentUserId && currentUserId !== userId) {
      // TODO: Check if current user is admin
      // For now, only allow self-update
      throw new ForbiddenException('You can only update your own profile');
    }

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
   * Xóa user
   */
  async remove(userId: string, currentUserId?: string): Promise<void> {
    const user = await this.findOne(userId);

    // Kiểm tra quyền: không cho phép xóa chính mình
    if (currentUserId && currentUserId === userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // TODO: Check if current user is admin

    await this.userRepository.remove(user);
  }
}
