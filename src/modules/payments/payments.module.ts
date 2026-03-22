import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsApiController } from './payments-api.controller';
import { PaymentsService } from './payments.service';
import { BillingModule } from '../billing/billing.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    BillingModule,
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [PaymentsController, PaymentsApiController],
  providers: [PaymentsService],
  exports: [TypeOrmModule, PaymentsService],
})
export class PaymentsModule {}
