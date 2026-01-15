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

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

    // Create new user
    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      language: registerDto.language ?? 'vi',
      avatar_url: registerDto.avatar_url ?? null,
      system_role_id: null, // Will be set by admin or default role
    });

    const savedUser = await this.userRepository.save(user);

    // Generate tokens
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

    return { accessToken, refreshToken };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

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

    // Generate tokens
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

    return { accessToken, refreshToken };
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

  profile(userId: string): ProfileResponseDto {
    // TODO: Replace with real user lookup from database
    return { id: userId, email: 'user@example.com', name: 'User' };
  }

  async changePassword(
    email: string,
    newPassword: string,
  ): Promise<void> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email },
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
