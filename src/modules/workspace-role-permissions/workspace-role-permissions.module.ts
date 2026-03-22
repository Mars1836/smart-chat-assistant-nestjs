import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceRolePermission } from './entities/workspace-role-permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceRolePermission])],
  exports: [TypeOrmModule],
})
export class WorkspaceRolePermissionsModule {}
