import {
  AuthModule,
} from '../auth/auth.module';

import {
  forwardRef,
  Module,
} from '@nestjs/common';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  InventoryModule,
} from '../inventory/inventory.module';

import {
  Order,
  OrderSchema,
} from '../orders/schemas/order.schema';

import {
  RefundsModule,
} from '../refunds/refunds.module';

import {
  ReturnsController,
} from './returns.controller';

import {
  ReturnsService,
} from './returns.service';

import {
  ReturnRequest,
  ReturnRequestSchema,
} from './schemas/return.schema';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    InventoryModule,
    RefundsModule,

    MongooseModule.forFeature([
      {
        name:
          ReturnRequest.name,

        schema:
          ReturnRequestSchema,
      },
      {
        name: Order.name,
        schema: OrderSchema,
      },
    ]),
  ],

  controllers: [
    ReturnsController,
  ],

  providers: [
    ReturnsService,
  ],

  exports: [
    ReturnsService,
  ],
})
export class ReturnsModule {}
