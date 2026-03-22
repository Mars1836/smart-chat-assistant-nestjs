import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WorkspaceWallet } from './entities/workspace-wallet.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletTopupSession } from './entities/wallet-topup-session.entity';
import { LlmModel } from './entities/llm-model.entity';
import { BillingService } from './billing.service';
import { Payment } from '../payments/entities/payment.entity';
import { BillingController } from './billing.controller';
import { LlmModelService } from './llm-model.service';
import { LlmModelsController } from './llm-models.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceWallet,
      WalletTransaction,
      WalletTopupSession,
      LlmModel,
      Payment,
    ]),
    ConfigModule,
    forwardRef(() => AuthModule),
    UsersModule,
  ],
  controllers: [BillingController, LlmModelsController],
  providers: [BillingService, LlmModelService],
  exports: [BillingService, LlmModelService],
})
export class BillingModule {}

