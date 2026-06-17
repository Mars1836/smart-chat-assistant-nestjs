import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  MessageEvent,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { WORKSPACE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { User } from '../../common/decorators';

@ApiTags('billing')
@ApiBearerAuth('JWT-auth')
@Controller('workspaces/:workspaceId/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Số dư ví workspace' })
  async getWallet(@Param('workspaceId') workspaceId: string) {
    const wallet = await this.billingService.getBalance(workspaceId);
    return {
      workspace_id: wallet.workspace_id,
      balance: Number(wallet.balance || '0'),
      currency: wallet.currency,
      status: wallet.status,
      updated_at: wallet.updated_at,
    };
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(WORKSPACE_PERMISSIONS.BILLING_VIEW_TRANSACTIONS)
  @ApiOperation({
    summary: 'Lịch sử giao dịch ví / token (chỉ Owner & Admin workspace)',
    description:
      'Giao dịch tiền (topup, refund, adjustment) và usage. FE mapping: `amount` luôn là credits (+/-), `credit_amount` là bản sao chuẩn hóa theo credits, `token_amount` chỉ có ý nghĩa với usage (số token đã dùng, lưu âm).',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({
    status: 403,
    description: 'Chỉ Owner hoặc Admin workspace mới xem được',
  })
  async getTransactions(
    @Param('workspaceId') workspaceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    @Query('type') type?: 'topup' | 'usage' | 'refund' | 'adjustment',
  ) {
    return this.billingService.findAllTransactions(workspaceId, {
      page,
      limit,
      sortBy,
      sortOrder,
      type,
    });
  }

  @Post('vietqr')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tạo VietQR nạp tiền' })
  async createVietQR(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { amount: number },
    @User('sub') userId: string,
  ) {
    const result = await this.billingService.createVietQRTopup(
      workspaceId,
      Number(body.amount),
      userId,
    );
    return result;
  }

  @Sse('wallet/stream')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'SSE cập nhật số dư ví (realtime)',
    description:
      'EventSource không gửi header Authorization. Truyền JWT qua query: `?access_token=<jwt>` hoặc `?token=<jwt>`.',
  })
  walletStream(
    @Param('workspaceId') workspaceId: string,
  ): Observable<MessageEvent> {
    return this.billingService.getWalletStream(workspaceId);
  }
}
