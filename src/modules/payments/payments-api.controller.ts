import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../common/decorators';
import { PaymentsService } from './payments.service';
import {
  PaymentListQueryDto,
  PaymentResponseDto,
  PaymentStatsSummaryDto,
  PaymentStatsByDateQueryDto,
  PaymentStatsByDateItemDto,
} from './dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../../common/dto';

@ApiTags('payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsApiController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiExtraModels(PaymentResponseDto, PaginatedResponseDto, PaginationMetaDto)
  @ApiOperation({
    summary: 'Danh sách giao dịch',
    description:
      'User: chỉ giao dịch của mình. Admin: tất cả, có thể lọc theo user_id. Query: page, limit, sortBy, sortOrder, status, provider, user_id.',
  })
  @ApiOkResponse({
    description: 'Paginated list of payments',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(PaymentResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query() query: PaymentListQueryDto,
    @User('sub') currentUserId: string,
  ) {
    return this.paymentsService.findAll(query, currentUserId);
  }

  @Get('stats/summary')
  @ApiOperation({
    summary: 'Thống kê tổng quan giao dịch',
    description:
      'User: thống kê của mình. Admin: toàn hệ thống, có thể truyền query user_id để xem thống kê một user.',
  })
  @ApiOkResponse({
    description: 'Thống kê tổng quan',
    type: PaymentStatsSummaryDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getStatsSummary(
    @User('sub') currentUserId: string,
    @Query('user_id') filterUserId?: string,
  ) {
    return this.paymentsService.getStatsSummary(currentUserId, filterUserId);
  }

  @Get('stats/by-date')
  @ApiOperation({
    summary: 'Thống kê giao dịch theo thời gian',
    description:
      'Số giao dịch và tổng tiền theo từng ngày/tuần/tháng. User: của mình. Admin: có thể truyền user_id.',
  })
  @ApiOkResponse({
    description: 'Mảng { date, count, amount }',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          count: { type: 'number' },
          amount: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getStatsByDate(
    @Query() query: PaymentStatsByDateQueryDto,
    @User('sub') currentUserId: string,
  ) {
    return this.paymentsService.getStatsByDate(query, currentUserId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết một giao dịch',
    description: 'User: chỉ xem được giao dịch của mình. Admin: xem bất kỳ.',
  })
  @ApiOkResponse({
    description: 'Chi tiết giao dịch',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Chỉ được xem giao dịch của chính mình',
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id') id: string, @User('sub') currentUserId: string) {
    return this.paymentsService.findOne(id, currentUserId);
  }
}
