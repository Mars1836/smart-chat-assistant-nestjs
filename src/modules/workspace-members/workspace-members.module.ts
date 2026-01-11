import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMember } from './entities/workspace-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceMember])],
  exports: [TypeOrmModule],
})
export class WorkspaceMembersModule {}
