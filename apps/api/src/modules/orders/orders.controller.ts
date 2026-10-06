import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
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

import {
  PaymentsService,
} from '../payments/payments.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders:
      OrdersService,

    private readonly payments:
      PaymentsService,
  ) {}

  /*
   * Guest checkout. For an online payment the answer also carries
   * `payment.gatewayUrl`, the page to send the customer to.
   */
  @Post()
  placeOrder(
    @Body()
    dto: PlaceOrderDto,

    @Headers(
      'x-idempotency-key',
    )
    idempotencyKey?: string,
  ) {
    return this.payments
      .checkout(
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

    @Req()
    request: any,
  ) {
    /*
     * AuthGuard has put the signed-in admin on the request. Their
     * email is recorded in the order's status history.
     */
    return this.orders
      .updateStatus(
        orderNumber,
        dto,
        request.user?.email ||
          'admin',
      );
  }

  /*
   * A cancelled order that was paid online has been refunded in the
   * SSLCOMMERZ merchant panel; record that here.
   */
  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Patch(
    ':orderNumber/refunded',
  )
  markRefunded(
    @Param('orderNumber')
    orderNumber: string,

    @Req()
    request: any,
  ) {
    return this.orders
      .markRefunded(
        orderNumber,
        request.user?.email ||
          'admin',
      );
  }
}
