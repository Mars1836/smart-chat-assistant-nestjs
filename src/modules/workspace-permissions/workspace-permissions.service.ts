import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { WorkspacePermission } from '../workspace-permissions/entities/workspace-permission.entity';
import { WorkspaceRolePermission } from '../workspace-role-permissions/entities/workspace-role-permission.entity';
import { WorkspaceMemberPermission } from '../workspace-member-permissions/entities/workspace-member-permission.entity';

@Injectable()
export class WorkspacePermissionsService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    @InjectRepository(WorkspacePermission)
    private readonly permissionRepo: Repository<WorkspacePermission>,
    @InjectRepository(WorkspaceRolePermission)
    private readonly rolePermissionRepo: Repository<WorkspaceRolePermission>,
    @InjectRepository(WorkspaceMemberPermission)
    private readonly memberPermissionRepo: Repository<WorkspaceMemberPermission>,
  ) {}

  /**
   * Check if user has permission in workspace
   */
  async checkPermission(
    workspaceId: string,
    userId: string,
    permissionName: string,
  ): Promise<boolean> {
    // 1. Get member details with role
    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId, is_active: true },
      relations: ['workspaceRole'],
    });

    if (!member) return false;

    // 2. Get permission ID
    const permission = await this.permissionRepo.findOne({
      where: { name: permissionName },
    });

    if (!permission) return false; // Permission doesn't exist

    // 3. Check role permissions
    const hasRolePermission = await this.rolePermissionRepo.findOne({
      where: {
        workspace_role_id: member.workspaceRole.id,
        permission_id: permission.id,
      },
    });

    let hasAccess = !!hasRolePermission;

    // 4. Check custom member permissions (overrides)
    const customPermission = await this.memberPermissionRepo.findOne({
      where: {
        workspace_member_id: member.id,
        permission_id: permission.id,
      },
    });

    if (customPermission) {
      if (customPermission.grant_type === 'grant') {
        hasAccess = true;
      } else if (customPermission.grant_type === 'revoke') {
        hasAccess = false;
      }
    }

    return hasAccess;
  }
}
