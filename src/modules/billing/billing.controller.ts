import { Body, Controller, Get, Param, Post, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BillingService } from './billing.service';

@Controller('workspaces/:workspaceId/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('wallet')
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

  @Post('vietqr')
  async createVietQR(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { amount: number },
  ) {
    const result = await this.billingService.createVietQRTopup(
      workspaceId,
      Number(body.amount),
    );
    return result;
  }

  @Sse('wallet/stream')
  walletStream(
    @Param('workspaceId') workspaceId: string,
  ): Observable<MessageEvent> {
    return this.billingService.getWalletStream(workspaceId);
  }
}

