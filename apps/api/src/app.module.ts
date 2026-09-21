import { Module } from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { MongooseModule } from '@nestjs/mongoose';

import { HealthModule } from './health/health.module';
import { RedisModule } from './infrastructure/redis/redis.module';

import { SupgentModule } from './integrations/supgent/supgent.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';

import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';

import { CartsModule } from './modules/carts/carts.module';
import { CheckoutModule } from './modules/checkout/checkout.module';

import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShippingModule } from './modules/shipping/shipping.module';

import { CouponsModule } from './modules/coupons/coupons.module';

import { ReturnsModule } from './modules/returns/returns.module';
import { RefundsModule } from './modules/refunds/refunds.module';

import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '../../.env',
        '.env',
      ],
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (
        config: ConfigService,
      ) => ({
        uri:
          config.get<string>('MONGODB_URI') ??
          'mongodb://localhost:27017/sgcommerce',

        serverSelectionTimeoutMS: 5000,
      }),
    }),

    RedisModule,
    HealthModule,

    AuthModule,
    UsersModule,
    CustomersModule,

    CatalogModule,
    InventoryModule,

    CartsModule,
    CheckoutModule,

    OrdersModule,
    PaymentsModule,
    ShippingModule,

    CouponsModule,

    ReturnsModule,
    RefundsModule,

    NotificationsModule,
    WebhooksModule,

    SupgentModule,
  ],
})
export class AppModule {}
