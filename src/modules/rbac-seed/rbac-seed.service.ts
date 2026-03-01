import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { WorkspacePermission } from '../workspace-permissions/entities/workspace-permission.entity';
import { WorkspaceRolePermission } from '../workspace-role-permissions/entities/workspace-role-permission.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import {
  WORKSPACE_PERMISSIONS,
  WORKSPACE_ROLES,
} from '../../common/constants/permissions.constant';

@Injectable()
export class RbacSeedService implements OnModuleInit {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(
    @InjectRepository(WorkspaceRole)
    private readonly roleRepo: Repository<WorkspaceRole>,
    @InjectRepository(WorkspacePermission)
    private readonly permissionRepo: Repository<WorkspacePermission>,
    @InjectRepository(WorkspaceRolePermission)
    private readonly rolePermissionRepo: Repository<WorkspaceRolePermission>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
  ) {}

  async onModuleInit() {
    this.logger.log('Seeding RBAC data...');
    await this.seedPermissions();
    await this.seedRoles();
    await this.seedRolePermissions();
    // await this.syncWorkspaceOwners();
    this.logger.log('RBAC seeding completed.');
  }

  private async syncWorkspaceOwners() {
    this.logger.log('Syncing workspace owners to members table...');
    const workspaces = await this.workspaceRepo.find();
    const ownerRole = await this.roleRepo.findOne({
      where: { name: WORKSPACE_ROLES.OWNER },
    });

    if (!ownerRole) {
      this.logger.error('Owner role not found, skipping sync.');
      return;
    }

    let syncedCount = 0;
    for (const workspace of workspaces) {
      const exists = await this.memberRepo.findOne({
        where: {
          workspace_id: workspace.id,
          user_id: workspace.owner_id,
        },
      });

      if (!exists) {
        await this.memberRepo.save(
          this.memberRepo.create({
            workspace_id: workspace.id,
            user_id: workspace.owner_id,
            workspace_role_id: ownerRole.id,
            is_active: true,
          }),
        );
        syncedCount++;
      }
    }
    this.logger.log(`Synced ${syncedCount} missing workspace owners.`);
  }

  private async seedPermissions() {
    const permissions = Object.values(WORKSPACE_PERMISSIONS);
    for (const permissionName of permissions) {
      const exists = await this.permissionRepo.findOne({
        where: { name: permissionName },
      });
      if (!exists) {
        // Parse resource and action from name like 'resource.action'
        const [resource, action] = permissionName.split('.');
        await this.permissionRepo.save(
          this.permissionRepo.create({
            name: permissionName,
            category: resource,
            action: action,
            description: `Permission to ${action} on ${resource}`,
          }),
        );
      }
    }
  }

  private async seedRoles() {
    const roles = [
      { name: WORKSPACE_ROLES.OWNER, level: 100 },
      { name: WORKSPACE_ROLES.ADMIN, level: 50 },
      { name: WORKSPACE_ROLES.EDITOR, level: 20 },
      { name: WORKSPACE_ROLES.VIEWER, level: 10 },
    ];

    for (const role of roles) {
      const exists = await this.roleRepo.findOne({
        where: { name: role.name },
      });
      if (!exists) {
        await this.roleRepo.save(
          this.roleRepo.create({
            name: role.name,
            level: role.level,
            description: `Standard ${role.name} role`,
          }),
        );
      }
    }
  }

  private async seedRolePermissions() {
    // 1. Get all roles
    const ownerRole = await this.roleRepo.findOne({
      where: { name: WORKSPACE_ROLES.OWNER },
    });
    const adminRole = await this.roleRepo.findOne({
      where: { name: WORKSPACE_ROLES.ADMIN },
    });
    const editorRole = await this.roleRepo.findOne({
      where: { name: WORKSPACE_ROLES.EDITOR },
    });
    const viewerRole = await this.roleRepo.findOne({
      where: { name: WORKSPACE_ROLES.VIEWER },
    });

    if (!ownerRole || !adminRole || !editorRole || !viewerRole) return;

    // 2. Define permission sets
    const allPermissions = Object.values(WORKSPACE_PERMISSIONS);

    const adminPermissions = allPermissions.filter(
      (p) =>
        p !== WORKSPACE_PERMISSIONS.WORKSPACE_DELETE,
    );

    const editorPermissions = [
      WORKSPACE_PERMISSIONS.CHATBOT_CREATE,
      WORKSPACE_PERMISSIONS.CHATBOT_UPDATE,
      WORKSPACE_PERMISSIONS.CHATBOT_DELETE,
      WORKSPACE_PERMISSIONS.CHATBOT_VIEW,
      WORKSPACE_PERMISSIONS.CHATBOT_CHAT,
      WORKSPACE_PERMISSIONS.DOCUMENT_UPLOAD,
      WORKSPACE_PERMISSIONS.DOCUMENT_UPDATE,
      WORKSPACE_PERMISSIONS.DOCUMENT_DELETE,
      WORKSPACE_PERMISSIONS.DOCUMENT_VIEW,
      WORKSPACE_PERMISSIONS.MEMBER_VIEW,
    ];

    const viewerPermissions = [
      WORKSPACE_PERMISSIONS.CHATBOT_VIEW,
      WORKSPACE_PERMISSIONS.CHATBOT_CHAT,
      WORKSPACE_PERMISSIONS.DOCUMENT_VIEW,
      WORKSPACE_PERMISSIONS.MEMBER_VIEW,
    ];

    // 3. Map roles to permissions
    await this.assignPermissions(ownerRole, allPermissions);
    await this.assignPermissions(adminRole, adminPermissions);
    await this.assignPermissions(editorRole, editorPermissions);
    await this.assignPermissions(viewerRole, viewerPermissions);
  }

  private async assignPermissions(role: WorkspaceRole, permissions: string[]) {
    for (const permissionName of permissions) {
      const permission = await this.permissionRepo.findOne({
        where: { name: permissionName },
      });
      if (permission) {
        const exists = await this.rolePermissionRepo.findOne({
          where: {
             workspace_role_id: role.id,
             permission_id: permission.id
          },
        });

        if (!exists) {
            await this.rolePermissionRepo.save({
                workspace_role_id: role.id,
                permission_id: permission.id
            });
        }
      }
    }
  }
}
