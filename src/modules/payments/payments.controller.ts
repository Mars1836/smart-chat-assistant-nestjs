import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../billing/billing.service';

interface SePayCallbackPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string;
  content: string;
  transferType: 'in' | 'out';
  description: string;
  transferAmount: number;
  accumulated: number;
  referenceCode: string;
}

@Controller('payment/webhook')
export class PaymentsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
  ) {}

  private readonly logger = new Logger(PaymentsController.name);

  /**
   * Webhook callback từ SePay khi có giao dịch chuyển tiền vào tài khoản.
   *
   * - Method: POST
   * - URL:   /payment/webhook/callback
   * - Auth:  Header Authorization: Apikey <SEPAY_API_KEY>
   *
   * Lưu ý:
   * - SePay chỉ gửi khi giao dịch THÀNH CÔNG.
   * - Nội dung chuyển khoản (content/description) CHỈ cần chứa chuỗi ngắn:
   *     WS-<code>
   *   trong đó <code> là mã phiên nạp tiền 11 ký tự (A-Z0-9), sinh bởi BillingService.createVietQRTopup.
   */
  @Post('callback')
  @HttpCode(200)
  async handleSePayCallback(
    @Headers('authorization') authHeader: string,
    @Body() payload: SePayCallbackPayload,
  ) {
    this.logger.log(`SePay callback received: ${JSON.stringify(payload)}`);

    const expectedApiKey =
      this.configService.get<string>('SEPAY_API_KEY') || '';

    if (
      !authHeader ||
      !authHeader.startsWith('Apikey ') ||
      !expectedApiKey ||
      authHeader.substring(7).trim() !== expectedApiKey
    ) {
      // Không lộ chi tiết cho client ngoài, trả 401 đơn giản
      return { success: false, message: 'Unauthorized' };
    }

    // Chỉ xử lý tiền vào
    if (payload.transferType !== 'in') {
      return { success: true, message: 'Ignored non-incoming transfer' };
    }

    const text = `${payload.content || ''} ${payload.description || ''}`;

    // Tìm session code trong nội dung: pattern WS<CODE> với CODE = 11 ký tự A-Z0-9
    const match = text.match(/WS([A-Z0-9]{11})/i);
    if (!match) {
      // Không tìm thấy session code, vẫn trả 200 để tránh retry
      this.logger.warn(
        `SePay callback: topup session code not found in content/description. text="${text}"`,
      );
      return {
        success: false,
        message: 'Topup session code not found in transfer content',
      };
    }

    const sessionCode = match[1].toUpperCase();
    this.logger.log(
      `SePay callback: resolved topup session code=${sessionCode}`,
    );

    const amount = Number(payload.transferAmount || 0);

    if (!amount || amount <= 0) {
      return {
        success: false,
        message: 'Invalid transfer amount',
      };
    }

    // Ghi nhận topup vào ví workspace thông qua session code
    // BillingService sẽ lookup session -> workspaceId và apply topup nếu session còn pending.
    await this.billingService.applyTopupBySessionCode(sessionCode, amount, {
      sepay_id: payload.id,
      gateway: payload.gateway,
      accountNumber: payload.accountNumber,
      transactionDate: payload.transactionDate,
      code: payload.code,
      content: payload.content,
      description: payload.description,
      referenceCode: payload.referenceCode,
    });

    return {
      success: true,
      message: 'Topup applied',
    };
  }
}
