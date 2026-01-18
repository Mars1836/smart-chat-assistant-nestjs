import { SetMetadata } from '@nestjs/common';
import { WorkspacePermissionType } from '../constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';
export const  RequirePermissions = (...permissions: WorkspacePermissionType[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
