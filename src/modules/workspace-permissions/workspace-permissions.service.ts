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
    // 0. Check if user is Workspace Owner -> Full Access
    const workspace = await this.memberRepo.manager
      .getRepository('Workspace')
      .findOne({ where: { id: workspaceId } });

    if (workspace && (workspace as any).owner_id === userId) {
      return true;
    }

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

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<WorkspacePermission[]> {
    return await this.permissionRepo.find({
      order: { category: 'ASC', action: 'ASC' },
    });
  }

  /**
   * Get user's permissions in a workspace
   */
  async getUserPermissions(
    workspaceId: string,
    userId: string,
  ): Promise<string[]> {
    // Check if user is owner
    const workspace = await this.memberRepo.manager
      .getRepository('Workspace')
      .findOne({ where: { id: workspaceId } });

    if (workspace && (workspace as any).owner_id === userId) {
      // Owner has all permissions
      const allPermissions = await this.getAllPermissions();
      return allPermissions.map((p) => p.name);
    }

    // Get member with role
    const member = await this.memberRepo.findOne({
      where: { workspace_id: workspaceId, user_id: userId, is_active: true },
      relations: ['workspaceRole'],
    });

    if (!member) return [];

    // Get role permissions
    const rolePermissions = await this.rolePermissionRepo.find({
      where: { workspace_role_id: member.workspaceRole.id },
      relations: ['permission'],
    });

    const permissionNames = new Set(
      rolePermissions.map((rp) => rp.permission.name),
    );

    // Apply custom member permissions (overrides)
    const customPermissions = await this.memberPermissionRepo.find({
      where: { workspace_member_id: member.id },
      relations: ['permission'],
    });

    for (const custom of customPermissions) {
      if (custom.grant_type === 'grant') {
        permissionNames.add(custom.permission.name);
      } else if (custom.grant_type === 'revoke') {
        permissionNames.delete(custom.permission.name);
      }
    }

    return Array.from(permissionNames);
  }
}
