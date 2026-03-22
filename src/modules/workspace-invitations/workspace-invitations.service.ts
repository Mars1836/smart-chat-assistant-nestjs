import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailerService } from '@nestjs-modules/mailer';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceRole } from '../workspace-roles/entities/workspace-role.entity';
import { InviteMemberDto } from '../workspace-members/dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WorkspaceInvitationsService {
  constructor(
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationRepo: Repository<WorkspaceInvitation>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceRole)
    private readonly roleRepo: Repository<WorkspaceRole>,
    private readonly mailerService: MailerService,
  ) {}
  /**
   * Create invitation and send email
   */
  async createInvitation(
    workspaceId: string,
    inviterId: string,
    inviteDto: InviteMemberDto,
  ): Promise<WorkspaceInvitation> {
    // Validate workspace exists
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Validate role exists by name
    const role = await this.roleRepo.findOne({
      where: { name: inviteDto.role_name },
    });

    if (!role) {
      throw new NotFoundException(`Workspace role '${inviteDto.role_name}' not found`);
    }

    // Check if user exists (optional - they might not be registered yet)
    const existingUser = await this.userRepo.findOne({
      where: { email: inviteDto.email, is_deleted: false },
    });

    // If user exists, check if already a member
    if (existingUser) {
      const existingMember = await this.memberRepo.findOne({
        where: { workspace_id: workspaceId, user_id: existingUser.id },
      });

      if (existingMember) {
        throw new ConflictException(
          'User is already a member of this workspace',
        );
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await this.invitationRepo.findOne({
      where: {
        workspace_id: workspaceId,
        email: inviteDto.email,
        status: 'pending',
      },
    });

    // Generate token and expiration
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    if (existingInvitation) {
      // Update existing invitation
      existingInvitation.token = token;
      existingInvitation.expires_at = expiresAt;
      existingInvitation.workspace_role_id = role.id;
      const updated = await this.invitationRepo.save(existingInvitation);

      // Get inviter info
      const inviter = await this.userRepo.findOne({
        where: { id: inviterId, is_deleted: false },
      });
      const inviterName = inviter?.name ?? 'Someone';
      const inviterEmail = inviter?.email ?? '';

      // Send email
      this.sendInvitationEmail(inviteDto.email, workspace.name, token, inviterName, inviterEmail);

      return updated;
    }

    // Create new invitation
    const invitation = this.invitationRepo.create({
      workspace_id: workspaceId,
      email: inviteDto.email,
      workspace_role_id: role.id,
      invited_by: inviterId,
      token,
      expires_at: expiresAt,
      status: 'pending',
    });

    const saved = await this.invitationRepo.save(invitation);

    // Get inviter info
    const inviter = await this.userRepo.findOne({
      where: { id: inviterId, is_deleted: false },
    });
    const inviterName = inviter?.name ?? 'Someone';
    const inviterEmail = inviter?.email ?? '';

    // Send email
    this.sendInvitationEmail(inviteDto.email, workspace.name, token, inviterName, inviterEmail);

    return saved;
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ workspace: Workspace; role: WorkspaceRole }> {
    // Find invitation by token
    const invitation = await this.invitationRepo.findOne({
      where: { token },
      relations: ['workspace', 'workspaceRole'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      throw new ConflictException('Invitation has already been accepted');
    }

    // Check expiration
    if (new Date() > new Date(invitation.expires_at)) {
      // Mark as expired
      invitation.status = 'expired';
      await this.invitationRepo.save(invitation);
      throw new GoneException('Invitation has expired');
    }

    // Find user
    const user = await this.userRepo.findOne({
      where: { id: userId, is_deleted: false },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify email matches
    if (user.email !== invitation.email) {
      throw new BadRequestException(
        'This invitation was sent to a different email address',
      );
    }

    // Check if already a member
    const existingMember = await this.memberRepo.findOne({
      where: {
        workspace_id: invitation.workspace_id,
        user_id: userId,
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this workspace');
    }

    // Create workspace member
    const member = this.memberRepo.create({
      workspace_id: invitation.workspace_id,
      user_id: userId,
      workspace_role_id: invitation.workspace_role_id,
      invited_by: invitation.invited_by,
      is_active: true,
    });

    await this.memberRepo.save(member);

    // Mark invitation as accepted
    invitation.status = 'accepted';
    await this.invitationRepo.save(invitation);

    return {
      workspace: invitation.workspace,
      role: invitation.workspaceRole,
    };
  }

  /**
   * Get pending invitations for workspace
   */
  async getInvitations(workspaceId: string) {
    return await this.invitationRepo.find({
      where: { workspace_id: workspaceId, status: 'pending' },
      relations: ['workspaceRole', 'invitedByUser'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    email: string,
    workspaceName: string,
    token: string,
    inviterName: string,
    inviterEmail: string,
  ): Promise<void> {
    const acceptLink = `${process.env.FE_DOMAIN ?? 'http://localhost:3000'}/accept-invite?token=${token}`;

    try {
      // Read email template
      const fs = require('fs');
      const path = require('path');
      const templatePath = path.join(
        process.cwd(),
        'src/common/mail_template/workspace-invitation.html',
      );
      let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');

      // Replace placeholders
      htmlTemplate = htmlTemplate
        .replace(/{{workspaceName}}/g, workspaceName)
        .replace(/{{acceptLink}}/g, acceptLink)
        .replace(/{{inviterName}}/g, inviterName)
        .replace(/{{inviterEmail}}/g, inviterEmail);

      await this.mailerService.sendMail({
        to: email,
        subject: `You've been invited to ${workspaceName}`,
        html: htmlTemplate,
      });

      console.log(`Invitation email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't throw error - invitation still created, just email failed
    }
  }

  /**
   * Resend invitation email (simplified - no workspaceId needed in params)
   */
  async resendInvitationSimple(
    invitationId: string,
    userId: string,
  ): Promise<void> {
    // First get invitation to know which workspace it belongs to
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId },
      relations: ['workspace'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if user has permission in this workspace
    // User must be a member with invite permission or owner
    const workspace = await this.workspaceRepo.findOne({
      where: { id: invitation.workspace_id },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is owner
    const isOwner = workspace.owner_id === userId;

    if (!isOwner) {
      // Check if user is member with invite permission
      const member = await this.memberRepo.findOne({
        where: {
          workspace_id: invitation.workspace_id,
          user_id: userId,
          is_active: true,
        },
      });

      if (!member) {
        throw new BadRequestException(
          'You do not have permission to resend invitations in this workspace',
        );
      }
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Can only resend pending invitations');
    }

    // Check if expired
    if (new Date() > new Date(invitation.expires_at)) {
      throw new GoneException('Invitation has expired');
    }

    // Generate new token and extend expiration
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    invitation.token = token;
    invitation.expires_at = expiresAt;
    await this.invitationRepo.save(invitation);

    // Get inviter info
    const inviter = await this.userRepo.findOne({
      where: { id: invitation.invited_by, is_deleted: false },
    });
    const inviterName = inviter?.name ?? 'Someone';
    const inviterEmail = inviter?.email ?? '';

    // Send email
    await this.sendInvitationEmail(
      invitation.email,
      invitation.workspace.name,
      token,
      inviterName,
      inviterEmail,
    );
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(
    invitationId: string,
    workspaceId: string,
  ): Promise<void> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, workspace_id: workspaceId },
      relations: ['workspace'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Can only resend pending invitations');
    }

    // Check if expired
    if (new Date() > new Date(invitation.expires_at)) {
      throw new GoneException('Invitation has expired');
    }

    // Generate new token and extend expiration
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    invitation.token = token;
    invitation.expires_at = expiresAt;
    await this.invitationRepo.save(invitation);

    // Get inviter info
    const inviter = await this.userRepo.findOne({
      where: { id: invitation.invited_by, is_deleted: false },
    });
    const inviterName = inviter?.name ?? 'Someone';
    const inviterEmail = inviter?.email ?? '';

    // Send email
    await this.sendInvitationEmail(
      invitation.email,
      invitation.workspace.name,
      token,
      inviterName,
      inviterEmail,
    );
  }

  /**
   * Cancel pending invitation
   */
  async cancelInvitation(
    invitationId: string,
    workspaceId: string,
  ): Promise<void> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, workspace_id: workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Can only cancel pending invitations');
    }

    // Delete the invitation
    await this.invitationRepo.remove(invitation);
  }
}
