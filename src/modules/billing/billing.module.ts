import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WorkspaceWallet } from './entities/workspace-wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletTopupSession } from './entities/wallet-topup-session.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceWallet, WalletTransaction, WalletTopupSession]),
    ConfigModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

