import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspacePermission } from './entities/workspace-permission.entity';
import { WorkspacePermissionsService } from './workspace-permissions.service';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { WorkspaceRolePermission } from '../workspace-role-permissions/entities/workspace-role-permission.entity';
import { WorkspaceMemberPermission } from '../workspace-member-permissions/entities/workspace-member-permission.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspacePermission,
      WorkspaceMember,
      WorkspaceRolePermission,
      WorkspaceMemberPermission,
    ]),
  ],
  providers: [WorkspacePermissionsService],
  exports: [TypeOrmModule, WorkspacePermissionsService],
})
export class WorkspacePermissionsModule {}
