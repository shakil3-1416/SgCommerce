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
  RefundsController,
} from './refunds.controller';

import {
  RefundsService,
} from './refunds.service';

import {
  Refund,
  RefundSchema,
} from './schemas/refund.schema';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([
      {
        name: Refund.name,
        schema: RefundSchema,
      },
    ]),
  ],

  controllers: [
    RefundsController,
  ],

  providers: [
    RefundsService,
  ],

  exports: [
    RefundsService,
  ],
})
export class RefundsModule {}
