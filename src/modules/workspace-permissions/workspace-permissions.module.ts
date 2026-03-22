import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspacePermission } from './entities/workspace-permission.entity';
import { WorkspacePermissionsService } from './workspace-permissions.service';
import { WorkspacePermissionsController } from './workspace-permissions.controller';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { WorkspaceRolePermission } from '../workspace-role-permissions/entities/workspace-role-permission.entity';
import { WorkspaceMemberPermission } from '../workspace-member-permissions/entities/workspace-member-permission.entity';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspacePermission,
      WorkspaceMember,
      WorkspaceRolePermission,
      WorkspaceMemberPermission,
    ]),
    AuthModule,
  ],
  controllers: [WorkspacePermissionsController],
  providers: [WorkspacePermissionsService],
  exports: [TypeOrmModule, WorkspacePermissionsService],
})
export class WorkspacePermissionsModule {}
