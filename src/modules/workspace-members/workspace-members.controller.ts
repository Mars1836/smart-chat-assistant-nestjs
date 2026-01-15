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
import { WorkspaceMembersService } from './workspace-members.service';
import { InviteMemberDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { User } from '../../common/decorators';

@ApiTags('workspace-members')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/members')
export class WorkspaceMembersController {
  constructor(
    private readonly workspaceMembersService: WorkspaceMembersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách thành viên trong workspace',
    description: 'Lấy tất cả thành viên đang active trong workspace',
  })
  @ApiResponse({
    status: 200,
    description: 'List of workspace members',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_id: 'work-space-uuid',
          user_id: 'user-uuid',
          workspace_role_id: 'role-uuid',
          invited_by: 'inviter-uuid',
          is_active: true,
          created_at: '2024-01-15T12:00:00Z',
          updated_at: '2024-01-15T12:00:00Z',
          user: {
            id: 'user-uuid',
            email: 'user@example.com',
            full_name: 'John Doe',
            avatar: null,
          },
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
  async getMembers(@Param('workspaceId') workspaceId: string) {
    return await this.workspaceMembersService.getMembers(workspaceId);
  }

  @Post('invite')
  @ApiOperation({
    summary: 'Mời thành viên vào workspace',
    description: `Mời người dùng vào workspace bằng email và gán role cụ thể.
    
**Roles có sẵn:**
- Owner (100): Toàn quyền
- Admin (50): Tất cả trừ xóa workspace  
- Editor (20): Quản lý chatbot & documents
- Viewer (10): Chỉ xem

**Lưu ý:** Email sẽ được gửi với link mời. Người nhận phải đăng nhập và chấp nhận lời mời.`,
  })
  @ApiResponse({
    status: 201,
    description: 'Member invited successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found or workspace not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already a member',
  })
  @ApiResponse({
    status: 403,
    description: 'No permission to invite members',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.MEMBER_INVITE)
  async inviteMember(
    @Param('workspaceId') workspaceId: string,
    @User('sub') inviterId: string,
    @Body() inviteDto: InviteMemberDto,
  ) {
    return await this.workspaceMembersService.inviteMember(
      workspaceId,
      inviterId,
      inviteDto,
    );
  }
}
