import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('api-schema')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api-schema')
  @ApiOperation({ summary: 'Lấy JSON schema của API' })
  @ApiQuery({
    name: 'module',
    required: false,
    description:
      'Tên module (tag) để lọc API. Ví dụ: chatbots, auth, workspaces',
    example: 'chatbots',
  })
  @ApiResponse({
    status: 200,
    description: 'API schema JSON',
  })
  getApiSchema(@Query('module') module?: string): Record<string, unknown> {
    return this.appService.getApiJson(module) as Record<string, unknown>;
  }

  @Get('api-modules')
  @ApiOperation({ summary: 'Lấy danh sách tất cả các modules có sẵn' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách modules',
    type: [String],
  })
  getModules() {
    return {
      modules: this.appService.getModules(),
    };
  }
}
