import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacSeedService } from './rbac-seed.service';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { WorkspacePermission } from '../workspace-permissions/entities/workspace-permission.entity';
import { WorkspaceRolePermission } from '../workspace-role-permissions/entities/workspace-role-permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceRole,
      WorkspacePermission,
      WorkspaceRolePermission,
    ]),
  ],
  providers: [RbacSeedService],
})
export class RbacSeedModule {}
