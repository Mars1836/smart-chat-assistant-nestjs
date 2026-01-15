import {
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { InviteMemberDto } from './dto';
import { WorkspaceInvitationsService } from '../workspace-invitations/workspace-invitations.service';

@Injectable()
export class WorkspaceMembersService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepo: Repository<WorkspaceMember>,
    private readonly invitationsService: WorkspaceInvitationsService,
  ) {}

  /**
   * Invite member (delegates to invitation service)
   */
  async inviteMember(
    workspaceId: string,
    inviterId: string,
    inviteDto: InviteMemberDto,
  ) {
    return await this.invitationsService.createInvitation(
      workspaceId,
      inviterId,
      inviteDto,
    );
  }

  /**
   * Get all members in workspace
   */
  async getMembers(workspaceId: string) {
    return await this.workspaceMemberRepo.find({
      where: { workspace_id: workspaceId, is_active: true },
      relations: ['user', 'workspaceRole', 'invitedByUser'],
      order: { created_at: 'DESC' },
    });
  }
}
