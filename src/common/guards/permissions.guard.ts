import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { WorkspacePermissionsService } from '../../modules/workspace-permissions/workspace-permissions.service';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: WorkspacePermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    const workspaceId = request.params.workspaceId || request.query.workspaceId;

    if (!user || !workspaceId) {
      throw new ForbiddenException(
        'User or Workspace ID not found in request context',
      );
    }

    // Check each permission (OR logic? or AND logic? Usually AND for strict security, but let's check one by one)
    // Here implementing AND logic: User must have ALL required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionsService.checkPermission(
        workspaceId,
        user.sub, // Assuming request.user has sub (userId)
        permission,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `You do not have permission: ${permission}`,
        );
      }
    }

    return true;
  }
}
