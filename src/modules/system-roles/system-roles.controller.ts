import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { SystemRolesService } from './system-roles.service';
import { SystemRole } from './entities/system-role.entity';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';

@ApiTags('system-roles')
@Controller('system-roles')
export class SystemRolesController {
  constructor(private readonly systemRolesService: SystemRolesService) {}

  @Get()
  @ApiExtraModels(
    PaginatedResponseDto,
    PaginationMetaDto,
    PaginationDto,
    SystemRole,
  )
  @ApiOperation({
    summary: 'Get all system roles (with pagination)',
    description:
      'Trả về danh sách system roles với phân trang. Hỗ trợ query params: page, limit, sortBy, sortOrder',
  })
  @ApiOkResponse({
    description: 'Paginated list of system roles',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(SystemRole) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'admin',
            description: 'Administrator role',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        meta: {
          total: 10,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    },
  })
  findAll(@Query() pagination?: PaginationDto) {
    // Cung cấp giá trị mặc định nếu pagination không được truyền vào
    const paginationDto: PaginationDto = pagination || {
      page: 1,
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    };
    return this.systemRolesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get system role by ID' })
  @ApiResponse({ status: 200, description: 'System role found' })
  @ApiResponse({ status: 404, description: 'System role not found' })
  findOne(@Param('id') id: string): Promise<SystemRole | null> {
    return this.systemRolesService.findOne(id);
  }
}
