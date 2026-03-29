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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserStatsSummaryDto,
  UserStatsByDateQueryDto,
  UserStatsByDateItemDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemAdminGuard } from './guards/system-admin.guard';
import { User } from '../../common/decorators';
import {
  PaginationDto,
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../common/dto';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(SystemAdminGuard)
  @ApiOperation({ summary: 'Tạo user mới (chỉ admin)' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin mới được tạo user' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Lấy thông tin profile của user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@User('sub') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Get()
  @UseGuards(SystemAdminGuard)
  @ApiExtraModels(
    UserResponseDto,
    PaginatedResponseDto,
    PaginationMetaDto,
    PaginationDto,
  )
  @ApiOperation({
    summary: 'Lấy danh sách users (chỉ admin)',
    description:
      'Trả về danh sách users với phân trang. Chỉ admin. Query: page, limit, sortBy, sortOrder',
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin mới được xem danh sách' })
  @ApiOkResponse({
    description: 'Paginated list of users',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(UserResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Nguyễn Văn A',
            email: 'user@example.com',
            avatar_url: 'https://example.com/avatar.jpg',
            language: 'vi',
            system_role_id: null,
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
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get('stats/summary')
  @UseGuards(SystemAdminGuard)
  @ApiOperation({
    summary: 'Thống kê tổng quan user (chỉ admin)',
    description:
      'Tổng số user, số theo vai trò (admin/user/no_role), user mới 7/30 ngày qua',
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin' })
  @ApiOkResponse({
    description: 'Thống kê tổng quan',
    type: UserStatsSummaryDto,
  })
  getStatsSummary(): Promise<UserStatsSummaryDto> {
    return this.usersService.getStatsSummary();
  }

  @Get('stats/by-date')
  @UseGuards(SystemAdminGuard)
  @ApiOperation({
    summary: 'Thống kê user theo thời gian (chỉ admin)',
    description:
      'Số user tạo mới theo từng ngày/tuần/tháng trong khoảng from–to. Dùng cho biểu đồ.',
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin' })
  @ApiOkResponse({
    description: 'Mảng { date, count }',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, count: { type: 'number' } },
      },
    },
  })
  getStatsByDate(
    @Query() query: UserStatsByDateQueryDto,
  ): Promise<UserStatsByDateItemDto[]> {
    return this.usersService.getStatsByDate(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy thông tin chi tiết user',
    description: 'Xem chính mình: mọi user. Xem user khác: chỉ admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Chỉ admin mới được xem user khác' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string, @User('sub') currentUserId?: string) {
    return this.usersService.findOne(id, currentUserId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Cập nhật profile của user hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  updateProfile(
    @User('sub') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, updateUserDto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật user' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - can only update own profile',
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @User('sub') currentUserId?: string,
  ) {
    return this.usersService.update(id, updateUserDto, currentUserId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa user' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - cannot delete own account',
  })
  remove(@Param('id') id: string, @User('sub') currentUserId?: string) {
    return this.usersService.remove(id, currentUserId);
  }
}
