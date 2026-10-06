import { forwardRef, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { SslcommerzClient } from './sslcommerz.client';

/*
 * Global so the two places an order is placed (the orders controller for
 * guests, the auth controller for signed-in customers) can use it without
 * their modules importing this one.
 */
@Global()
@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => OrdersModule),
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, SslcommerzClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
