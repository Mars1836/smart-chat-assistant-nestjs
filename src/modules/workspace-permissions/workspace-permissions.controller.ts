import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WorkspacePermissionsService } from './workspace-permissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators';

@ApiTags('workspace-permissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspace-permissions')
export class WorkspacePermissionsController {
  constructor(
    private readonly workspacePermissionsService: WorkspacePermissionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tất cả permissions',
    description: 'Lấy danh sách tất cả các quyền có sẵn trong hệ thống',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all permissions',
  })
  async getAllPermissions() {
    return await this.workspacePermissionsService.getAllPermissions();
  }

  @Get('workspaces/:workspaceId/user')
  @ApiOperation({
    summary: 'Lấy danh sách quyền của user trong workspace',
    description:
      'Lấy danh sách các tên quyền mà user hiện tại có trong workspace cụ thể',
  })
  @ApiResponse({
    status: 200,
    description: 'List of permission names for the user in workspace',
    type: [String],
  })
  async getUserPermissions(
    @Param('workspaceId') workspaceId: string,
    @User('sub') userId: string,
  ) {
    const permissions =
      await this.workspacePermissionsService.getUserPermissions(
        workspaceId,
        userId,
      );
    return { permissions };
  }
}
