import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspacePermission } from './entities/workspace-permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspacePermission])],
  exports: [TypeOrmModule],
})
export class WorkspacePermissionsModule {}
