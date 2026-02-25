import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceWallet } from './entities/workspace-wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletTopupSession } from './entities/wallet-topup-session.entity';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly walletStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(WorkspaceWallet)
    private readonly walletRepo: Repository<WorkspaceWallet>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    @InjectRepository(WalletTopupSession)
    private readonly sessionRepo: Repository<WalletTopupSession>,
    private readonly configService: ConfigService,
  ) {}

  async getOrCreateWallet(workspaceId: string): Promise<WorkspaceWallet> {
    let wallet = await this.walletRepo.findOne({
      where: { workspace_id: workspaceId },
    });

    if (!wallet) {
      wallet = this.walletRepo.create({
        workspace_id: workspaceId,
        balance: '0',
        currency: 'CREDITS',
        status: 'active',
      });
      wallet = await this.walletRepo.save(wallet);
    }

    return wallet;
  }

  async getBalance(workspaceId: string): Promise<WorkspaceWallet> {
    return this.getOrCreateWallet(workspaceId);
  }

  getWalletStream(workspaceId: string): Observable<MessageEvent> {
    let subject = this.walletStreams.get(workspaceId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.walletStreams.set(workspaceId, subject);
    }

    // Gửi snapshot ban đầu khi client subscribe
    this.emitWalletSnapshot(workspaceId).catch((err) => {
      this.logger.error('Failed to emit initial wallet snapshot', err);
    });

    return subject.asObservable();
  }

  private async emitWalletSnapshot(workspaceId: string): Promise<void> {
    const subject = this.walletStreams.get(workspaceId);
    if (!subject) return;

    const wallet = await this.getOrCreateWallet(workspaceId);
    subject.next({
      data: {
        workspace_id: wallet.workspace_id,
        balance: Number(wallet.balance || '0'),
        currency: wallet.currency,
        status: wallet.status,
        updated_at: wallet.updated_at,
      },
    });
  }

  /**
   * Charge usage based on token counts.
   * Pricing is controlled via ENV:
   * - BILLING_PRICE_PER_1K_TOKENS (default 0) – same rate for all providers/models for now.
   */
  async chargeUsage(
    workspaceId: string,
    provider: string,
    model: string,
    usage: LLMUsage,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const pricePer1K =
      Number(this.configService.get<string>('BILLING_PRICE_PER_1K_TOKENS')) || 0;

    if (!pricePer1K) {
      // Billing disabled – still log usage transaction with amount 0 for observability
      this.logger.debug(
        `Billing disabled (BILLING_PRICE_PER_1K_TOKENS=0). Logging usage only for workspace ${workspaceId}.`,
      );
    }

    const totalTokens =
      (usage.input_tokens || 0) + (usage.output_tokens || 0);
    const amount = (totalTokens * pricePer1K) / 1000;

    const wallet = await this.getOrCreateWallet(workspaceId);

    // Update balance only when pricePer1K > 0
    if (pricePer1K > 0) {
      const current = Number(wallet.balance || '0');
      const newBalance = current - amount;
      wallet.balance = newBalance.toFixed(4);
      await this.walletRepo.save(wallet);
    }

    const tx = this.txRepo.create({
      workspace_id: workspaceId,
      type: 'usage',
      amount: (-amount).toFixed(4),
      description: `LLM usage: provider=${provider}, model=${model}, tokens=${totalTokens}`,
      llm_provider: provider,
      llm_model: model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      metadata: metadata || null,
    });

    await this.txRepo.save(tx);

    // Có thể phát SSE nếu muốn hiển thị realtime usage trên FE
    await this.emitWalletSnapshot(workspaceId);
  }

  /**
   * Generate VietQR payment info (QR image URL + reference) for a given workspace and amount.
   * FE có thể dùng để hiển thị QR topup theo từng mốc tiền.
   *
   * Đồng thời tạo 1 topup session với code ngắn 11 ký tự (A-Z0-9) để gắn vào nội dung chuyển khoản.
   * Webhook sẽ sử dụng code này để tìm ra workspace tương ứng.
   *
   * ENV cần cấu hình:
   * - VIETQR_BANK_ID: mã ngân hàng theo VietQR (vd: VCB, TCB, MBBANK...) - dùng trong part `<bankId>-<accountNo>`
   * - VIETQR_ACCOUNT_NO: số tài khoản nhận tiền
   * - VIETQR_ACCOUNT_NAME: tên chủ tài khoản (optional, chỉ để FE hiển thị)
   * - VIETQR_BASE_URL: base URL (mặc định: https://img.vietqr.io/image)
   */
  async createVietQRTopup(
    workspaceId: string,
    amount: number,
  ): Promise<{
    amount: number;
    currency: string;
    reference: string;
    qr_image_url: string;
    bank: {
      bank_id: string;
      account_no: string;
      account_name: string | null;
    };
  }> {
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const bankId =
      this.configService.get<string>('VIETQR_BANK_ID') || 'VCB';
    const accountNo =
      this.configService.get<string>('VIETQR_ACCOUNT_NO') || '';
    const accountName =
      this.configService.get<string>('VIETQR_ACCOUNT_NAME') || null;
    const baseUrl =
      this.configService.get<string>('VIETQR_BASE_URL') ||
      'https://img.vietqr.io/image';

    if (!accountNo) {
      throw new Error(
        'VIETQR_ACCOUNT_NO is not configured. Cannot generate VietQR.',
      );
    }

    // Tạo session với code ngắn 11 ký tự
    const session = await this.createTopupSession(workspaceId, amount);

    // Tham chiếu topup nội bộ + nội dung chuyển khoản: chỉ cần chuỗi ngắn WS<code>
    // VD: WSCP142KD8ZF4
    const ref = `WS${session.code}`;
    const addInfo = encodeURIComponent(ref);
    const qrImageUrl = `${baseUrl}/${encodeURIComponent(
      bankId,
    )}-${encodeURIComponent(accountNo)}-qr_only.png?amount=${Math.floor(
      amount,
    )}&addInfo=${addInfo}`;

    return {
      amount: Math.floor(amount),
      currency: 'VND',
      reference: ref,
      qr_image_url: qrImageUrl,
      bank: {
        bank_id: bankId,
        account_no: accountNo,
        account_name: accountName,
      },
    };
  }

  private generateTopupCode(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 11; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
  }

  private async createTopupSession(
    workspaceId: string,
    amount: number,
  ): Promise<WalletTopupSession> {
    // Tạo code duy nhất (retry vài lần nếu trùng)
    for (let i = 0; i < 5; i++) {
      const code = this.generateTopupCode();
      const existing = await this.sessionRepo.findOne({ where: { code } });
      if (!existing) {
        const session = this.sessionRepo.create({
          workspace_id: workspaceId,
          code,
          amount: amount ? amount.toFixed(4) : null,
          status: 'pending',
          provider: 'sepay',
        });
        return this.sessionRepo.save(session);
      }
    }

    throw new Error('Failed to generate unique topup session code');
  }

  /**
   * Apply a topup to workspace wallet (e.g. from bank transfer / SePay callback).
   */
  async applyTopup(
    workspaceId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!amount || amount <= 0) {
      throw new Error('Topup amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(workspaceId);
    const current = Number(wallet.balance || '0');
    const newBalance = current + amount;
    wallet.balance = newBalance.toFixed(4);
    await this.walletRepo.save(wallet);

    const tx = this.txRepo.create({
      workspace_id: workspaceId,
      type: 'topup',
      amount: amount.toFixed(4),
      description,
      llm_provider: null,
      llm_model: null,
      input_tokens: null,
      output_tokens: null,
      metadata: metadata || null,
    });

    await this.txRepo.save(tx);

    // Phát SSE để FE biết ví đã tăng tiền
    await this.emitWalletSnapshot(workspaceId);
  }

  /**
   * Apply topup using session code (11-char code), used by SePay webhook.
   * - Lookup session by code
   * - If found & pending: applyTopup for corresponding workspace, mark session completed
   */
  async applyTopupBySessionCode(
    sessionCode: string,
    amount: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { code: sessionCode.toUpperCase() },
    });

    if (!session) {
      this.logger.warn(
        `Topup session not found for code=${sessionCode}, ignoring`,
      );
      return;
    }

    if (session.status === 'completed') {
      this.logger.log(
        `Topup session ${sessionCode} already completed, skipping duplicate callback`,
      );
      return;
    }

    await this.applyTopup(
      session.workspace_id,
      amount,
      `Topup via SePay (session ${sessionCode})`,
      {
        ...(metadata || {}),
        topup_session_id: session.id,
        topup_session_code: session.code,
      },
    );

    session.status = 'completed';
    await this.sessionRepo.save(session);
  }
}

