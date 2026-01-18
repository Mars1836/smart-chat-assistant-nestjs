import {
  Controller,
  Get,
  Post,
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
import { WorkspaceMemberPermissionsService } from './workspace-member-permissions.service';
import { GrantPermissionDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { User } from '../../common/decorators';

@ApiTags('workspace-member-permissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces/:workspaceId/members/:memberId/permissions')
export class WorkspaceMemberPermissionsController {
  constructor(
    private readonly service: WorkspaceMemberPermissionsService,
  ) {}

  @Get('effective-permissions')
  @ApiOperation({
    summary: 'Lấy tất cả các quyền (Effective Permissions) của member',
    description: 'Kết hợp quyền Role và Custom Permissions. Trả về chi tiết nguồn (Role/Custom) và trạng thái.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of effective permissions with details',
  })
  @RequirePermissions(WORKSPACE_PERMISSIONS.MEMBER_VIEW)
  async getEffectivePermissions(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    const permissions = await this.service.getDetailedPermissions(workspaceId, memberId);
    return { permissions };
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách quyền custom (Grant/Revoke) của member' })
  @ApiResponse({ status: 200, description: 'List of custom permissions' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.MEMBER_VIEW)
  async listPermissions(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return await this.service.listPermissions(workspaceId, memberId);
  }

  @Post()
  @ApiOperation({
    summary: 'Grant hoặc Revoke quyền cho member',
    description: `Gán hoặc thu hồi quyền cụ thể (ghi đè role permissions).
    
**Rules:**
- **Grant**: Thêm quyền mà Role chưa có.
- **Revoke**: Chặn quyền mà Role đang có.
- (Revoke mạnh hơn Grant và Role).

**Quyền hạn:**
- Chỉ **Admin** và **Owner** mới được dùng API này.
- Admin không được sửa quyền của Admin khác.
- Không ai được sửa quyền của Owner.`,
  })
  @ApiResponse({ status: 201, description: 'Permission updated successfully' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.MEMBER_UPDATE_ROLE)
  async updatePermission(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @User('sub') requesterId: string,
    @Body() dto: GrantPermissionDto,
  ) {
    return await this.service.updatePermission(
      workspaceId,
      memberId,
      requesterId,
      dto,
    );
  }
}
