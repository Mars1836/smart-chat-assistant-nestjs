import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceRole } from './entities/workspace-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceRole])],
  exports: [TypeOrmModule],
})
export class WorkspaceRolesModule {}
