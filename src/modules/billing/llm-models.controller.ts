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
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SystemAdminGuard } from '../users/guards/system-admin.guard';
import { LlmModelService } from './llm-model.service';
import { CreateLlmModelDto, UpdateLlmModelDto } from './dto/llm-model.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LlmModel } from './entities/llm-model.entity';

@ApiTags('llm-models')
@ApiBearerAuth('JWT-auth')
@Controller('llm-models')
export class LlmModelsController {
  constructor(private readonly llmModelService: LlmModelService) {}

  @Get('pricing')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bảng giá token theo model (cho client tham khảo)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách model + giá input/output',
  })
  async getPricing(): Promise<LlmModel[]> {
    return this.llmModelService.findAllForPricing();
  }

  @Get()
  @UseGuards(JwtAuthGuard, SystemAdminGuard)
  @ApiOperation({ summary: 'Danh sách model và giá input/output (admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list' })
  async findAll(@Query() query: PaginationDto) {
    return this.llmModelService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, SystemAdminGuard)
  @ApiOperation({ summary: 'Chi tiết một bản ghi model (admin)' })
  @ApiResponse({ status: 200, description: 'LlmModel' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('id') id: string): Promise<LlmModel> {
    return this.llmModelService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, SystemAdminGuard)
  @ApiOperation({ summary: 'Tạo bản ghi model mới (admin)' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (provider+model đã tồn tại)',
  })
  async create(@Body() dto: CreateLlmModelDto): Promise<LlmModel> {
    return this.llmModelService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, SystemAdminGuard)
  @ApiOperation({ summary: 'Cập nhật model (admin)' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLlmModelDto,
  ): Promise<LlmModel> {
    return this.llmModelService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, SystemAdminGuard)
  @ApiOperation({ summary: 'Xóa bản ghi model (admin)' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.llmModelService.remove(id);
    return { message: 'Deleted' };
  }
}
