import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  RequireRole,
} from '../auth/auth.guard';

import {
  PlaceOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

import {
  OrdersService,
} from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders:
      OrdersService,
  ) {}

  @Post()
  placeOrder(
    @Body()
    dto: PlaceOrderDto,

    @Headers(
      'x-idempotency-key',
    )
    idempotencyKey?: string,
  ) {
    return this.orders
      .placeOrder(
        dto,
        idempotencyKey,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Get()
  list(
    @Query('status')
    status?: string,
  ) {
    return this.orders
      .list(status);
  }

  @Get(
    'track/:orderNumber',
  )
  track(
    @Param('orderNumber')
    orderNumber: string,

    @Query('phone')
    phone: string,
  ) {
    return this.orders
      .track(
        orderNumber,
        phone ?? '',
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Get(':orderNumber')
  get(
    @Param('orderNumber')
    orderNumber: string,
  ) {
    return this.orders
      .get(orderNumber);
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Patch(
    ':orderNumber/status',
  )
  updateStatus(
    @Param('orderNumber')
    orderNumber: string,

    @Body()
    dto:
      UpdateOrderStatusDto,
  ) {
    return this.orders
      .updateStatus(
        orderNumber,
        dto,
      );
  }
}
