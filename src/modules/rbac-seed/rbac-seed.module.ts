import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacSeedService } from './rbac-seed.service';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { WorkspacePermission } from '../workspace-permissions/entities/workspace-permission.entity';
import { WorkspaceRolePermission } from '../workspace-role-permissions/entities/workspace-role-permission.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceRole,
      WorkspacePermission,
      WorkspaceRolePermission,
      Workspace,
      WorkspaceMember,
    ]),
  ],
  providers: [RbacSeedService],
})
export class RbacSeedModule {}
