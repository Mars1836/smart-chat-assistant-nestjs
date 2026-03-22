import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request } from 'express';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  AuthResponseDto,
  RefreshResponseDto,
  ProfileResponseDto,
  ChangePasswordDto,
} from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'User registration',
    description: 'Register a new user account with email and password',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error or invalid data',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with email and password, returns JWT tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid credentials or validation error',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password',
  })
  login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get a new access token using refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired refresh token',
  })
  refresh(@Body() refreshDto: RefreshDto): RefreshResponseDto {
    return this.authService.refresh(refreshDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Retrieve authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async profile(@Req() req: Request): Promise<ProfileResponseDto> {
    const user = req['user'] as { sub: string; email: string } | undefined;
    if (!user) {
      throw new Error('User not found in request');
    }
    return await this.authService.profile(user.sub);
  }

  @Post('change-password')
  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description: 'Đổi mật khẩu cho tài khoản bằng email',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiBadRequestResponse({
    description: 'Validation error or invalid data',
  })
  @ApiUnauthorizedResponse({
    description: 'User not found',
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(
      changePasswordDto.email,
      changePasswordDto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }
}
