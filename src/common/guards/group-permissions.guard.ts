import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

@Injectable()
export class GroupPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'group-permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as { sub: string; email: string } | undefined;
    const groupId = request.params['groupId'] ?? request.body?.['groupId'];

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!groupId) {
      throw new BadRequestException('Group ID is required');
    }

    // TODO: Implement permission check logic with GroupMemberPermissionsService
    // When implementing async permission check, change return type to Promise<boolean> and add async
    // const hasPermission = await this.groupMemberPermissionsService.checkPermission(
    //   user.sub,
    //   groupId,
    //   requiredPermissions
    // );
    // if (!hasPermission) {
    //   throw new ForbiddenException(`You don't have permission: ${requiredPermissions.join(' or ')}`);
    // }

    return true;
  }
}
