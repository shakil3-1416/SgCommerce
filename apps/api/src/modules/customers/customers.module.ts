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
  CustomersController,
} from './customers.controller';

import {
  CustomersService,
} from './customers.service';

import {
  Customer,
  CustomerSchema,
} from './schemas/customer.schema';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      {
        name: Customer.name,
        schema: CustomerSchema,
      },
    ]),
  ],

  controllers: [
    CustomersController,
  ],

  providers: [
    CustomersService,
  ],

  exports: [
    CustomersService,
  ],
})
export class CustomersModule {}
