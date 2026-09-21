import {
  forwardRef,
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
} from '@nestjs/config';

import {
  CustomersModule,
} from '../customers/customers.module';

import {
  OrdersModule,
} from '../orders/orders.module';

import {
  UsersModule,
} from '../users/users.module';

import {
  AuthController,
} from './auth.controller';

import {
  AuthGuard,
} from './auth.guard';

import {
  AuthService,
} from './auth.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    CustomersModule,
    forwardRef(() => OrdersModule),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    AuthGuard,
  ],

  exports: [
    AuthService,
    AuthGuard,
  ],
})
export class AuthModule {}
