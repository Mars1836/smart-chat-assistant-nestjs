import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface CurrentUserData {
  sub: string;
  email: string;
}

/**
 * Decorator để lấy thông tin user hiện tại từ JWT payload
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: CurrentUserData) {
 *   return { userId: user.sub, email: user.email };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request['user'] as CurrentUserData;
  },
);
