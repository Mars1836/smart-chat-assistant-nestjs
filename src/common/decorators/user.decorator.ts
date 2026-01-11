import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserPayload } from '../interfaces/user-payload.interface';

/**
 * Decorator để lấy thông tin user từ JWT payload
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@User() user: UserPayload) {
 *   return { userId: user.sub, email: user.email };
 * }
 *
 * // Lấy chỉ userId
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * getMe(@User('sub') userId: string) {
 *   return this.service.findOne(userId);
 * }
 * ```
 */
export const User = createParamDecorator(
  (
    data: keyof UserPayload | undefined,
    ctx: ExecutionContext,
  ): string | UserPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request['user'] as UserPayload;

    // Nếu có data, trả về property cụ thể (vd: 'sub' hoặc 'email')
    if (data) {
      return user?.[data] as string;
    }
    return user;
  },
);
