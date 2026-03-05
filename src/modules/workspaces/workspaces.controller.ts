import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiExtraModels,
  ApiBearerAuth,
  getSchemaPath,
} from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
  WorkspaceStatsSummaryDto,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { SystemAdminGuard } from '../users/guards/system-admin.guard';

@ApiTags('workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo workspace mới' })
  @ApiResponse({
    status: 201,
    description: 'Workspace created successfully',
    type: WorkspaceResponseDto,
  })
  create(
    @User('sub') userId: string,
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(userId, createWorkspaceDto);
  }

  @Get()
  @ApiExtraModels(WorkspaceResponseDto, PaginatedResponseDto, PaginationMetaDto)
  @ApiOperation({
    summary: 'Lấy danh sách workspaces của user (có phân trang)',
    description:
      'Trả về danh sách workspaces với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of workspaces',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(WorkspaceResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'My Workspace',
            description: 'Workspace mô tả',
            owner_id: 'user-uuid-here',
            is_personal: false,
            icon: '🚀',
            color: '#3B82F6',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
          hasNextPage: true,
          hasPreviousPage: false,
        },
      },
    },
  })
  findAll(@User('sub') userId: string, @Query() pagination: PaginationDto) {
    return this.workspacesService.findAll(userId, pagination);
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết workspace' })
  @ApiResponse({
    status: 200,
    description: 'Workspace details',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_VIEW_SETTINGS)
  findOne(@Param('workspaceId') id: string, @User('sub') userId: string) {
    return this.workspacesService.findOne(id, userId);
  }

  @Patch(':workspaceId')
  @ApiOperation({ summary: 'Cập nhật workspace' })
  @ApiResponse({
    status: 200,
    description: 'Workspace updated successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Only owner can update' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_UPDATE)
  update(
    @Param('workspaceId') id: string,
    @User('sub') userId: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, userId, updateWorkspaceDto);
  }

  @Delete(':workspaceId')
  @ApiOperation({ summary: 'Xóa workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only owner can delete' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.WORKSPACE_DELETE)
  remove(@Param('workspaceId') id: string, @User('sub') userId: string) {
    return this.workspacesService.remove(id, userId);
  }

  @Get(':workspaceId/chatbot')
  @ApiOperation({ summary: 'Lấy thông tin chatbot của workspace' })
  @ApiResponse({ status: 200, description: 'Chatbot details' })
  @ApiResponse({ status: 404, description: 'Chatbot not found' })
  @RequirePermissions(WORKSPACE_PERMISSIONS.CHATBOT_VIEW)
  getChatbot(@Param('workspaceId') id: string, @User('sub') userId: string) {
    return this.workspacesService.getChatbot(id, userId);
  }
}

@ApiTags('workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SystemAdminGuard)
@Controller('admin/workspaces')
export class WorkspacesAdminController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('stats/summary')
  @ApiOperation({
    summary: 'Thống kê tổng quan workspaces & chatbots (chỉ admin hệ thống)',
    description:
      'Tổng số workspace, tổng số chatbot, trung bình chatbot/workspace, số workspace mới 7/30 ngày qua, số chatbot mới 7/30 ngày qua.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thống kê tổng quan workspaces & chatbots',
    type: WorkspaceStatsSummaryDto,
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin hệ thống' })
  getStatsSummary(): Promise<WorkspaceStatsSummaryDto> {
    return this.workspacesService.getStatsSummary();
  }
}
