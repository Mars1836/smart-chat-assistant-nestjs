import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { InviteMemberDto } from './dto';
import { WorkspaceInvitationsService } from '../workspace-invitations/workspace-invitations.service';

@Injectable()
export class WorkspaceMembersService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepo: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceRole)
    private readonly roleRepo: Repository<WorkspaceRole>,
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
   * Update member role
   */
  async updateRole(
    workspaceId: string,
    memberId: string,
    requesterId: string,
    roleName: string,
  ) {
    // 1. Get member
    const member = await this.workspaceMemberRepo.findOne({
      where: { id: memberId, workspace_id: workspaceId },
      relations: ['workspaceRole'],
    });

    if (!member) {
      throw new NotFoundException('Member not found in this workspace');
    }

    // 2. Verify Requester Permissions
    const requester = await this.workspaceMemberRepo.findOne({
      where: { user_id: requesterId, workspace_id: workspaceId },
      relations: ['workspaceRole'],
    });

    if (!requester || !requester.workspaceRole) {
       throw new ForbiddenException('Requester is not a member of this workspace');
    }

    const requesterRoleName = requester.workspaceRole.name;
    const targetRoleName = member.workspaceRole.name;

    // Rule 1: Cannot change your own role
    if (member.id === requester.id) {
       throw new ForbiddenException('Cannot change your own role');
    }

    // Rule 2: Nobody can modify Owner
    if (targetRoleName === 'Owner') {
       throw new ForbiddenException('Cannot modify Workspace Owner role');
    }

    // Rule 3: Only Owner can grant Admin role
    if (roleName === 'Admin' && requesterRoleName !== 'Owner') {
        throw new ForbiddenException('Only Owner can promote members to Admin');
    }

    // Rule 4: Admin restrictions
    if (requesterRoleName === 'Admin') {
       if (targetRoleName === 'Admin') {
          throw new ForbiddenException('Admins cannot modify other Admins');
       }
    }

    // 3. Get new role
    const role = await this.roleRepo.findOne({
      where: { name: roleName },
    });

    if (!role) {
      throw new NotFoundException(`Role '${roleName}' not found`);
    }

    if (role.name === 'Owner') {
       throw new ForbiddenException('Cannot change role to Owner. Use transfer ownership instead.');
    }

    // 3. Update
    member.workspace_role_id = role.id;
    member.workspaceRole = role; // Update relation object so response is correct
    return await this.workspaceMemberRepo.save(member);
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
