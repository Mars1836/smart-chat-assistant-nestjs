import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../users.service';

/**
 * Guard kiểm tra user hiện tại có system_role = 'admin'.
 * Dùng kèm JwtAuthGuard (chạy sau JwtAuthGuard để request.user đã có).
 */
@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = request['user'] as { sub: string } | undefined;
    const userId = payload?.sub;

    if (!userId) {
      throw new ForbiddenException('Unauthorized');
    }

    const user = await this.usersService.findOne(userId);
    if (user.systemRole?.name !== 'admin') {
      throw new ForbiddenException(
        'Chỉ quản trị viên hệ thống (admin) mới được thực hiện thao tác này',
      );
    }

    return true;
  }
}
