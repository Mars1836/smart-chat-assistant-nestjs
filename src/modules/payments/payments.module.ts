import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), BillingModule],
  controllers: [PaymentsController],
  exports: [TypeOrmModule],
})
export class PaymentsModule {}
