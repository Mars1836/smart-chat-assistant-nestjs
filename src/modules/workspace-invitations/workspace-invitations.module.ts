import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { WorkspaceInvitationsController } from './workspace-invitations.controller';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceInvitation,
      WorkspaceMember,
      User,
      Workspace,
      WorkspaceRole,
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [WorkspaceInvitationsController],
  providers: [WorkspaceInvitationsService],
  exports: [TypeOrmModule, WorkspaceInvitationsService],
})
export class WorkspaceInvitationsModule {}
