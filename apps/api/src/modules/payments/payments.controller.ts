import {
  All,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard, RequireRole } from '../auth/auth.guard';
import { OrdersService } from '../orders/orders.service';
import { NotificationSource, PaymentsService } from './payments.service';

/*
 * SSLCOMMERZ posts form fields, many of them, so these handlers take the
 * body as a plain object: the global validation pipe leaves it alone.
 */
type Fields = Record<string, unknown>;

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly orders: OrdersService,
  ) {}

  /** For the checkout page: which ways of paying to offer. */
  @Get('methods')
  methods() {
    return this.payments.methods();
  }

  /** For the "order placed" page: whether the order is paid. Nothing private. */
  @Get('status/:orderNumber')
  status(@Param('orderNumber') orderNumber: string) {
    return this.orders.paymentSummary(orderNumber);
  }

  /** For the admin: whether online payment is set up, and what is missing. */
  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Get('setup')
  setup() {
    return this.payments.setup();
  }

  /*
   * The customer's browser arrives at one of these three after the
   * gateway. Whatever happens, the customer is sent on to the shop.
   */
  @All('sslcommerz/success')
  success(@Body() body: Fields, @Query() query: Fields, @Res() response: any) {
    return this.finish('success', { ...query, ...body }, response);
  }

  @All('sslcommerz/fail')
  fail(@Body() body: Fields, @Query() query: Fields, @Res() response: any) {
    return this.finish('fail', { ...query, ...body }, response);
  }

  @All('sslcommerz/cancel')
  cancel(@Body() body: Fields, @Query() query: Fields, @Res() response: any) {
    return this.finish('cancel', { ...query, ...body }, response);
  }

  /** SSLCOMMERZ's server tells this server directly. Always answered with 200. */
  @Post('sslcommerz/ipn')
  @HttpCode(200)
  async ipn(@Body() body: Fields) {
    try {
      await this.payments.handleNotification('ipn', body ?? {});
    } catch (error) {
      console.error('[payments] ipn failed', error);
    }

    return 'OK';
  }

  /** For the admin: ask SSLCOMMERZ what happened to an order's payment. */
  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Post(':orderNumber/check')
  @HttpCode(200)
  check(@Param('orderNumber') orderNumber: string) {
    return this.payments.check(orderNumber);
  }

  private async finish(source: NotificationSource, fields: Fields, response: any) {
    let result: Awaited<ReturnType<PaymentsService['handleNotification']>> = {
      orderNumber: null,
      outcome: 'pending',
    };

    try {
      result = await this.payments.handleNotification(source, fields);
    } catch (error) {
      console.error('[payments] return failed', source, error);
    }

    const url = this.payments.returnUrl(result);

    if (!url) {
      response
        .status(200)
        .type('text/plain')
        .send('Your payment has been recorded. You can close this page and return to the shop.');

      return;
    }

    // 303: the browser arrived with POST and must fetch the shop page with GET.
    response.redirect(303, url);
  }
}
