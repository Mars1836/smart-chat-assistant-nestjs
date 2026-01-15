import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { WorkspacePermissionsService } from '../../modules/workspace-permissions/workspace-permissions.service';



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
    const user = request.user; // User from JWT strategy (payload), not Entity
    const workspaceId =
      request.params.workspaceId ||
      request.query.workspaceId ||
      request.body.workspace_id ||
      request.body.workspaceId;

    if (!user || !workspaceId) {
      throw new ForbiddenException(
        'User or Workspace ID not found in request context',
      );
    }

    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionsService.checkPermission(
        workspaceId,
        user.sub,
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
