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
  AuthResponseDto,
  RefreshResponseDto,
  ProfileResponseDto,
  ChangePasswordDto,
} from './dto';
import type { AuthClientType } from './auth-client-type';
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

  private signTokens(userId: string, email: string): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = this.jwtService.sign({
      sub: userId,
      email,
    });
    const refreshToken = this.jwtService.sign(
      { sub: userId, email, type: 'refresh' },
      {
        expiresIn:
          this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES_IN') ??
          '7d',
      } as any,
    );
    return { accessToken, refreshToken };
  }

  private toAuthResponse(
    userWithRole: {
      id: string;
      name: string;
      email: string;
      systemRole?: { name: string } | null;
    },
    tokens: { accessToken: string; refreshToken: string },
    clientType: AuthClientType,
  ): AuthResponseDto {
    const base: AuthResponseDto = {
      accessToken: tokens.accessToken,
      id: userWithRole.id,
      name: userWithRole.name,
      email: userWithRole.email,
      system_role: userWithRole.systemRole?.name ?? null,
    };
    if (clientType === 'mobile') {
      base.refreshToken = tokens.refreshToken;
    }
    return base;
  }

  async register(
    registerDto: RegisterDto,
    clientType: AuthClientType,
  ): Promise<{ auth: AuthResponseDto; refreshToken: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

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

    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      language: registerDto.language ?? 'vi',
      avatar_url: registerDto.avatar_url ?? null,
      system_role_id: defaultUserRole.id,
    });

    const savedUser = await this.userRepository.save(user);

    const userWithRole = await this.userRepository.findOne({
      where: { id: savedUser.id, is_deleted: false },
      relations: ['systemRole'],
      select: ['id', 'name', 'email'],
    });

    const tokens = this.signTokens(savedUser.id, savedUser.email);
    return {
      auth: this.toAuthResponse(userWithRole!, tokens, clientType),
      refreshToken: tokens.refreshToken,
    };
  }

  async login(
    loginDto: LoginDto,
    clientType: AuthClientType,
  ): Promise<{ auth: AuthResponseDto; refreshToken: string }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: loginDto.email })
      .andWhere('user.is_deleted = :isDeleted', { isDeleted: false })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userWithRole = await this.userRepository.findOne({
      where: { id: user.id, is_deleted: false },
      relations: ['systemRole'],
      select: ['id', 'name', 'email'],
    });

    const tokens = this.signTokens(user.id, user.email);
    return {
      auth: this.toAuthResponse(userWithRole!, tokens, clientType),
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Rotates refresh token (new access + new refresh). Caller sets cookie for web.
   */
  async refresh(refreshToken: string): Promise<RefreshResponseDto> {
    let payload: { sub: string; email: string; type?: string };
    try {
      payload = this.jwtService.verify<{
        sub: string;
        email: string;
        type?: string;
      }>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, is_deleted: false },
      select: ['id', 'email'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = this.signTokens(user.id, user.email);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async profile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_deleted: false },
      select: [
        'id',
        'name',
        'email',
        'avatar_url',
        'language',
        'system_role_id',
      ],
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
    const user = await this.userRepository.findOne({
      where: { email, is_deleted: false },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    await this.userRepository.save(user);
  }
}
