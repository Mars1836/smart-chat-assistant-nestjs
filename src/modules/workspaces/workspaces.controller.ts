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
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';

@ApiTags('workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
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

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết workspace' })
  @ApiResponse({
    status: 200,
    description: 'Workspace details',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  findOne(@Param('id') id: string, @User('sub') userId: string) {
    return this.workspacesService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật workspace' })
  @ApiResponse({
    status: 200,
    description: 'Workspace updated successfully',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Only owner can update' })
  update(
    @Param('id') id: string,
    @User('sub') userId: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, userId, updateWorkspaceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only owner can delete' })
  remove(@Param('id') id: string, @User('sub') userId: string) {
    return this.workspacesService.remove(id, userId);
  }

  @Get(':id/chatbot')
  @ApiOperation({ summary: 'Lấy thông tin chatbot của workspace' })
  @ApiResponse({ status: 200, description: 'Chatbot details' })
  @ApiResponse({ status: 404, description: 'Chatbot not found' })
  getChatbot(@Param('id') id: string, @User('sub') userId: string) {
    return this.workspacesService.getChatbot(id, userId);
  }
}
