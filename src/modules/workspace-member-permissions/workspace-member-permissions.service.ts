import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMemberPermission } from './entities/workspace-member-permission.entity';
import { WorkspacePermission } from '../workspace-permissions/entities/workspace-permission.entity';
import { WorkspaceMember } from '../workspace-members/entities/workspace-member.entity';
import { GrantPermissionDto } from './dto';

import { WorkspacePermissionsService } from '../workspace-permissions/workspace-permissions.service';

@Injectable()
export class WorkspaceMemberPermissionsService {
  constructor(
    @InjectRepository(WorkspaceMemberPermission)
    private readonly memberPermissionRepo: Repository<WorkspaceMemberPermission>,
    @InjectRepository(WorkspacePermission)
    private readonly permissionRepo: Repository<WorkspacePermission>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    private readonly permissionsService: WorkspacePermissionsService,
  ) {}

  async getEffectivePermissions(workspaceId: string, memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, workspace_id: workspaceId },
    });
    if (!member) throw new NotFoundException('Member not found');
    
    return await this.permissionsService.getUserPermissions(workspaceId, member.user_id);
  }

  async getDetailedPermissions(workspaceId: string, memberId: string) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, workspace_id: workspaceId },
    });
    if (!member) throw new NotFoundException('Member not found');
    
    return await this.permissionsService.getDetailedUserPermissions(workspaceId, member.user_id);
  }

  async listPermissions(workspaceId: string, memberId: string) {
    return await this.memberPermissionRepo.find({
      where: { workspace_member_id: memberId },
      relations: ['permission', 'grantedByUser'],
    });
  }

  async updatePermission(
    workspaceId: string,
    memberId: string,
    requesterId: string,
    dto: GrantPermissionDto,
  ) {
    const { permission_name, action } = dto;

    // 1. Get Member
    const member = await this.memberRepo.findOne({
      where: { id: memberId, workspace_id: workspaceId },
      relations: ['workspaceRole'],
    });
    if (!member) throw new NotFoundException('Member not found');

    // 2. Validate Requester
    const requester = await this.memberRepo.findOne({
      where: { user_id: requesterId, workspace_id: workspaceId },
      relations: ['workspaceRole'],
    });
    if (!requester) throw new ForbiddenException('Requester not member');

    const requesterRole = requester.workspaceRole.name;
    const targetRole = member.workspaceRole.name;

    // Permissions Logic Checks (Similar to Update Role)
    if (member.id === requester.id) {
        // Can one revoke their own permission? Maybe.. but let's forbid for safety
        throw new ForbiddenException('Cannot modify your own permissions');
    }
    if (targetRole === 'Owner') {
        throw new ForbiddenException('Cannot modify permissions of Owner');
    }
    if (requesterRole === 'Admin' && targetRole === 'Admin') {
        throw new ForbiddenException('Admins cannot modify Admin permissions');
    }
    // Only Admin and Owner can do this (Guarded by Controller usually, but safe here too)
    if (requesterRole !== 'Owner' && requesterRole !== 'Admin') {
         throw new ForbiddenException('Permission denied');
    }

    // 3. Find Permission
    const permission = await this.permissionRepo.findOne({
      where: { name: permission_name },
    });
    if (!permission) throw new NotFoundException('Permission not found');

    // 4. Upsert Grant/Revoke
    let record = await this.memberPermissionRepo.findOne({
      where: {
        workspace_member_id: memberId,
        permission_id: permission.id,
      },
    });

    if (!record) {
      record = this.memberPermissionRepo.create({
        workspace_member_id: memberId,
        permission_id: permission.id,
        granted_by: requesterId, // Should be requester User ID, which is requesterId (from token sub)
      });
    }

    record.grant_type = action;
    record.granted_by = requesterId;
    record.granted_at = new Date(); // Update timestamp
    
    return await this.memberPermissionRepo.save(record);
  }
}
