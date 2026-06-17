import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiHeader,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { resolveAuthClientType } from './auth-client-type';
import {
  REFRESH_COOKIE_NAME,
  getRefreshCookieClearOptions,
  getRefreshCookieSetOptions,
} from './auth-cookie.util';
import {
  LoginDto,
  RegisterDto,
  RefreshDto,
  AuthResponseDto,
  RefreshResponseDto,
  ProfileResponseDto,
  ChangePasswordDto,
  LogoutDto,
} from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiHeader({
    name: 'X-Client-Type',
    required: false,
    description: 'web | mobile (overrides body client_type)',
    schema: { enum: ['web', 'mobile'] },
  })
  @ApiOperation({
    summary: 'User registration',
    description:
      'Register a new user. Web: refresh token is set as HttpOnly cookie. Mobile: refresh token is included in JSON.',
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
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const clientType = resolveAuthClientType(req, registerDto.client_type);
    const { auth, refreshToken } = await this.authService.register(
      registerDto,
      clientType,
    );
    if (clientType === 'web') {
      res.cookie(
        REFRESH_COOKIE_NAME,
        refreshToken,
        getRefreshCookieSetOptions(this.configService),
      );
    }
    return auth;
  }

  @Post('login')
  @ApiHeader({
    name: 'X-Client-Type',
    required: false,
    description: 'web | mobile (overrides body client_type)',
    schema: { enum: ['web', 'mobile'] },
  })
  @ApiOperation({
    summary: 'User login',
    description:
      'Web: HttpOnly refresh cookie + accessToken in body. Mobile: access + refresh in body.',
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
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const clientType = resolveAuthClientType(req, loginDto.client_type);
    const { auth, refreshToken } = await this.authService.login(
      loginDto,
      clientType,
    );
    if (clientType === 'web') {
      res.cookie(
        REFRESH_COOKIE_NAME,
        refreshToken,
        getRefreshCookieSetOptions(this.configService),
      );
    }
    return auth;
  }

  @Post('refresh')
  @ApiHeader({
    name: 'X-Client-Type',
    required: false,
    description:
      'Optional. If refresh cookie is present, response follows web rules (access only).',
    schema: { enum: ['web', 'mobile'] },
  })
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Web: send refresh HttpOnly cookie (no body). Mobile: send refreshToken in JSON. Cookie is preferred when both exist. Rotates refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @Req() req: Request,
    @Body() refreshDto: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as
      | string
      | undefined;
    const raw = cookieToken ?? refreshDto.refreshToken;
    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refresh(raw);
    const usedCookie = !!cookieToken;

    if (usedCookie) {
      res.cookie(
        REFRESH_COOKIE_NAME,
        result.refreshToken!,
        getRefreshCookieSetOptions(this.configService),
      );
      return { accessToken: result.accessToken };
    }

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('logout')
  @ApiHeader({
    name: 'X-Client-Type',
    required: false,
    schema: { enum: ['web', 'mobile'] },
  })
  @ApiOperation({
    summary: 'Logout',
    description:
      'Clears refresh cookie for web. Mobile may send refreshToken in body for future server-side revoke.',
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  logout(
    @Req() req: Request,
    @Body() body: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ): { success: boolean } {
    const clientType =
      body.refreshToken && body.refreshToken.length > 0
        ? 'mobile'
        : resolveAuthClientType(req, body.client_type);
    if (clientType === 'web') {
      res.clearCookie(
        REFRESH_COOKIE_NAME,
        getRefreshCookieClearOptions(this.configService),
      );
    }
    return { success: true };
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
