import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceMembersService } from './workspace-members.service';
import { WorkspaceMembersController } from './workspace-members.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceInvitationsModule } from '../workspace-invitations/workspace-invitations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceMember]),
    AuthModule,
    WorkspaceInvitationsModule,
  ],
  controllers: [WorkspaceMembersController],
  providers: [WorkspaceMembersService],
  exports: [TypeOrmModule, WorkspaceMembersService],
})
export class WorkspaceMembersModule {}
