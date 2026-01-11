import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMemberPermission } from './entities/workspace-member-permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceMemberPermission])],
  exports: [TypeOrmModule],
})
export class WorkspaceMemberPermissionsModule {}
