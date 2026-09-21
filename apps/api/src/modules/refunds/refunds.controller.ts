import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  RequireRole,
} from '../auth/auth.guard';

import {
  UpdateRefundDto,
} from './dto/refund.dto';

import {
  RefundsService,
} from './refunds.service';

@Controller('refunds')
@UseGuards(AuthGuard)
@RequireRole('admin')
export class RefundsController {
  constructor(
    private readonly refunds:
      RefundsService,
  ) {}

  @Get()
  list(
    @Query('status')
    status?: string,
  ) {
    return this.refunds
      .list(status);
  }

  @Get(':refundNumber')
  get(
    @Param('refundNumber')
    refundNumber: string,
  ) {
    return this.refunds
      .get(refundNumber);
  }

  @Patch(':refundNumber')
  update(
    @Param('refundNumber')
    refundNumber: string,

    @Body()
    dto:
      UpdateRefundDto,
  ) {
    return this.refunds
      .update(
        refundNumber,
        dto,
      );
  }
}
