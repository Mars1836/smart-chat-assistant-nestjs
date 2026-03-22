import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { CreateToolDto, CreateToolActionDto } from './dto/create-tool.dto';
import { UpdateToolDto, UpdateToolActionDto } from './dto/update-tool.dto';
import { Tool } from './entities/tool.entity';
import { ToolAction } from './entities/tool-action.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('tools')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả tools (builtin + custom)' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category (builtin, custom, community)',
  })
  @ApiQuery({
    name: 'enabled',
    required: false,
    description: 'Filter by enabled state (true/false)',
  })
  @ApiResponse({ status: 200, type: [Tool] })
  async findAll(
    @Query('category') category?: 'builtin' | 'custom' | 'community',
    @Query('enabled') enabled?: string,
  ): Promise<Tool[]> {
    const is_enabled =
      enabled !== undefined ? enabled === 'true' || enabled === '1' : undefined;

    return this.toolsService.findAll({
      category,
      is_enabled,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết 1 tool' })
  @ApiResponse({ status: 200, type: Tool })
  async findOne(@Param('id') id: string): Promise<Tool> {
    return this.toolsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo custom tool/plugin mới' })
  @ApiResponse({ status: 201, type: Tool })
  async create(@Body() dto: CreateToolDto): Promise<Tool> {
    return this.toolsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tool/plugin' })
  @ApiResponse({ status: 200, type: Tool })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateToolDto,
  ): Promise<Tool> {
    return this.toolsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa tool/plugin' })
  @ApiResponse({ status: 204, description: 'Tool deleted successfully' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.toolsService.remove(id);
  }

  // =====================
  // ACTION ENDPOINTS
  // =====================

  @Get(':toolId/actions')
  @ApiOperation({ summary: 'Lấy danh sách actions của tool' })
  @ApiResponse({ status: 200, type: [ToolAction] })
  async getActions(@Param('toolId') toolId: string): Promise<ToolAction[]> {
    return this.toolsService.getActionsForTool(toolId);
  }

  @Get(':toolId/actions/:actionId')
  @ApiOperation({ summary: 'Lấy chi tiết 1 action' })
  @ApiResponse({ status: 200, type: ToolAction })
  async getAction(
    @Param('toolId') toolId: string,
    @Param('actionId') actionId: string,
  ): Promise<ToolAction> {
    return this.toolsService.findAction(toolId, actionId);
  }

  @Post(':toolId/actions')
  @ApiOperation({ summary: 'Thêm action mới cho tool' })
  @ApiResponse({ status: 201, type: ToolAction })
  async createAction(
    @Param('toolId') toolId: string,
    @Body() dto: CreateToolActionDto,
  ): Promise<ToolAction> {
    return this.toolsService.createAction(toolId, dto);
  }

  @Patch(':toolId/actions/:actionId')
  @ApiOperation({ summary: 'Cập nhật action' })
  @ApiResponse({ status: 200, type: ToolAction })
  async updateAction(
    @Param('toolId') toolId: string,
    @Param('actionId') actionId: string,
    @Body() dto: UpdateToolActionDto,
  ): Promise<ToolAction> {
    return this.toolsService.updateAction(toolId, actionId, dto);
  }

  @Delete(':toolId/actions/:actionId')
  @ApiOperation({ summary: 'Xóa action' })
  @ApiResponse({ status: 204, description: 'Action deleted successfully' })
  async removeAction(
    @Param('toolId') toolId: string,
    @Param('actionId') actionId: string,
  ): Promise<void> {
    return this.toolsService.removeAction(toolId, actionId);
  }
}
