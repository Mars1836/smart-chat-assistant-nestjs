import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { AcceptInvitationDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { User } from '../../common/decorators';

@ApiTags('workspace-invitations')
@Controller('workspace-invitations')
export class WorkspaceInvitationsController {
  constructor(
    private readonly invitationsService: WorkspaceInvitationsService,
  ) {}

  @Get('workspaces/:workspaceId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Lấy danh sách lời mời đang pending',
    description: 'Lấy tất cả lời mời chưa được chấp nhận trong workspace',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending invitations',
    schema: {
      example: [
        {
          id: 'invitation-uuid',
          workspace_id: 'workspace-uuid',
          email: 'invited@example.com',
          workspace_role_id: 'role-uuid',
          invited_by: 'inviter-uuid',
          token: 'token-uuid',
          expires_at: '2024-01-22T12:00:00Z',
          status: 'pending',
          created_at: '2024-01-15T12:00:00Z',
          updated_at: '2024-01-15T12:00:00Z',
          workspaceRole: {
            id: 'role-uuid',
            name: 'Member',
            description: 'Can view and chat',
          },
          invitedByUser: {
            id: 'inviter-uuid',
            email: 'admin@example.com',
            full_name: 'Admin User',
          },
        },
      ],
    },
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.MEMBER_VIEW)
  async getInvitations(@Param('workspaceId') workspaceId: string) {
    return await this.invitationsService.getInvitations(workspaceId);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chấp nhận lời mời vào workspace',
    description: 'Sử dụng token từ email để chấp nhận lời mời và trở thành thành viên',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation accepted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Already accepted or already a member',
  })
  @ApiResponse({
    status: 410,
    description: 'Invitation has expired',
  })
  async acceptInvitation(
    @User('sub') userId: string,
    @Body() acceptDto: AcceptInvitationDto,
  ) {
    const result = await this.invitationsService.acceptInvitation(
      acceptDto.token,
      userId,
    );

    return {
      message: 'Invitation accepted successfully',
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
      },
      role: result.role.name,
    };
  }
}
