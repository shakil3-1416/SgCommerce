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
  CatalogModule,
} from '../catalog/catalog.module';

import {
  CustomersModule,
} from '../customers/customers.module';

import {
  InventoryModule,
} from '../inventory/inventory.module';

import {
  OrdersController,
} from './orders.controller';

import {
  OrdersService,
} from './orders.service';

import {
  Order,
  OrderSchema,
} from './schemas/order.schema';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    CatalogModule,
    CustomersModule,
    InventoryModule,

    MongooseModule.forFeature([
      {
        name: Order.name,
        schema: OrderSchema,
      },
    ]),
  ],

  controllers: [
    OrdersController,
  ],

  providers: [
    OrdersService,
  ],

  exports: [
    OrdersService,
  ],
})
export class OrdersModule {}
