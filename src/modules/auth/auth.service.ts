import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  AuthResponseDto,
  RefreshResponseDto,
  ProfileResponseDto,
  ChangePasswordDto,
} from './dto';
import { User } from '../users/entities/user.entity';
import { SystemRole } from '../system-roles/entities/system-role.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SystemRole)
    private readonly systemRoleRepository: Repository<SystemRole>,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    let defaultUserRole = await this.systemRoleRepository.findOne({
      where: { name: 'user' },
    });
    if (!defaultUserRole) {
      defaultUserRole = await this.systemRoleRepository.save(
        this.systemRoleRepository.create({
          name: 'user',
          description: 'Người dùng mặc định của hệ thống',
        }),
      );
    }

    // Create new user
    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      language: registerDto.language ?? 'vi',
      avatar_url: registerDto.avatar_url ?? null,
      system_role_id: defaultUserRole.id,
    });

    const savedUser = await this.userRepository.save(user);

    // Load với systemRole để trả system_role trong response
    const userWithRole = await this.userRepository.findOne({
      where: { id: savedUser.id, is_deleted: false },
      relations: ['systemRole'],
      select: ['id', 'name', 'email'],
    });

    const accessToken = this.jwtService.sign({
      sub: savedUser.id,
      email: savedUser.email,
    });
    const refreshToken = this.jwtService.sign(
      { sub: savedUser.id, type: 'refresh' },
      {
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN') ??
          '7d',
      } as any,
    );

    return {
      accessToken,
      refreshToken,
      id: userWithRole!.id,
      name: userWithRole!.name,
      email: userWithRole!.email,
      system_role: userWithRole!.systemRole?.name ?? null,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    // Find user by email
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: loginDto.email })
      .andWhere('user.is_deleted = :isDeleted', { isDeleted: false })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Load user với systemRole để trả system_role trong response (FE chuyển trang theo role)
    const userWithRole = await this.userRepository.findOne({
      where: { id: user.id, is_deleted: false },
      relations: ['systemRole'],
      select: ['id', 'name', 'email'],
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN') ??
          '7d',
      } as any,
    );

    return {
      accessToken,
      refreshToken,
      id: userWithRole!.id,
      name: userWithRole!.name,
      email: userWithRole!.email,
      system_role: userWithRole!.systemRole?.name ?? null,
    };
  }

  refresh(refreshDto: RefreshDto): RefreshResponseDto {
    // TODO: Verify refresh token and validate it hasn't been revoked
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
      }>(refreshDto.refreshToken);
      const accessToken = this.jwtService.sign({
        sub: payload.sub,
        email: payload.email,
      });
      return { accessToken };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  async profile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_deleted: false },
      select: ['id', 'name', 'email', 'avatar_url', 'language', 'system_role_id'],
      relations: ['systemRole'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      system_role: user.systemRole?.name ?? null,
    };
  }

  async changePassword(
    email: string,
    newPassword: string,
  ): Promise<void> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email, is_deleted: false },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Hash new password
    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);
  }
}
