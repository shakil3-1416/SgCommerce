import { Controller, Get, Param, Query, Req, UseFilters, UseGuards } from '@nestjs/common';

import { DeveloperExceptionFilter } from './api-error';
import { ApiKeyGuard, RequireScope } from './api-key.guard';
import {
  currentEnvironment,
  DEVELOPER_API_VERSION,
  RATE_WINDOW_SECONDS,
  READ_RATE_LIMIT,
} from './developer-api';
import { DeveloperReadService } from './developer-read.service';
import {
  CustomersQueryDto,
  InventoryQueryDto,
  OrdersQueryDto,
  PageQueryDto,
  PaymentsQueryDto,
  ProductsQueryDto,
  RefundsQueryDto,
  ReturnsQueryDto,
} from './dto/developer.dto';
import { applicationResource } from './resources';

/*
 * The Developer API. Base address: /api/v1/developer
 *
 * Every route needs an application's credential and, except the first,
 * a scope. Answers are { data } or { data, pagination }; failures are
 * { error: { code, message, request_id } }. See docs/DEVELOPER_API.md.
 */
@Controller('developer')
@UseGuards(ApiKeyGuard)
@UseFilters(DeveloperExceptionFilter)
export class DeveloperController {
  constructor(private readonly read: DeveloperReadService) {}

  /** The first call to make: confirms the credential and shows what it may do. */
  @Get()
  whoAmI(@Req() request: any) {
    return {
      data: {
        application: applicationResource(request.apiApplication),
        api_version: DEVELOPER_API_VERSION,
        environment: currentEnvironment(),
        rate_limit: { requests: READ_RATE_LIMIT, per_seconds: RATE_WINDOW_SECONDS },
      },
    };
  }

  /* Catalog */

  @RequireScope('products:read')
  @Get('products')
  listProducts(@Query() query: ProductsQueryDto) {
    return this.read.listProducts(query);
  }

  @RequireScope('products:read')
  @Get('products/:productId')
  getProduct(@Param('productId') productId: string) {
    return this.read.getProduct(productId);
  }

  @RequireScope('products:read')
  @Get('categories')
  listCategories() {
    return this.read.listCategories();
  }

  /* Inventory */

  @RequireScope('inventory:read')
  @Get('inventory')
  listInventory(@Query() query: InventoryQueryDto) {
    return this.read.listInventory(query);
  }

  @RequireScope('inventory:read')
  @Get('inventory/:sku')
  getInventory(@Param('sku') sku: string) {
    return this.read.getInventory(sku);
  }

  @RequireScope('inventory:read')
  @Get('inventory/:sku/movements')
  listStockMovements(@Param('sku') sku: string, @Query() query: PageQueryDto) {
    return this.read.listStockMovements(sku, query);
  }

  /* Customers */

  @RequireScope('customers:read')
  @Get('customers')
  listCustomers(@Query() query: CustomersQueryDto) {
    return this.read.listCustomers(query);
  }

  @RequireScope('customers:read')
  @Get('customers/:customerId')
  getCustomer(@Param('customerId') customerId: string) {
    return this.read.getCustomer(customerId);
  }

  /* The orders of a customer are orders: reading them takes the orders scope. */
  @RequireScope('orders:read')
  @Get('customers/:customerId/orders')
  listCustomerOrders(@Param('customerId') customerId: string, @Query() query: PageQueryDto) {
    return this.read.listCustomerOrders(customerId, query);
  }

  /* Orders */

  @RequireScope('orders:read')
  @Get('orders')
  listOrders(@Query() query: OrdersQueryDto) {
    return this.read.listOrders(query);
  }

  @RequireScope('orders:read')
  @Get('orders/:orderNumber')
  getOrder(@Param('orderNumber') orderNumber: string) {
    return this.read.getOrder(orderNumber);
  }

  /* Payments */

  @RequireScope('payments:read')
  @Get('payments')
  listPayments(@Query() query: PaymentsQueryDto) {
    return this.read.listPayments(query);
  }

  @RequireScope('payments:read')
  @Get('payments/:paymentId')
  getPayment(@Param('paymentId') paymentId: string) {
    return this.read.getPayment(paymentId);
  }

  /* Returns and refunds */

  @RequireScope('returns:read')
  @Get('returns')
  listReturns(@Query() query: ReturnsQueryDto) {
    return this.read.listReturns(query);
  }

  @RequireScope('returns:read')
  @Get('returns/:returnNumber')
  getReturn(@Param('returnNumber') returnNumber: string) {
    return this.read.getReturn(returnNumber);
  }

  @RequireScope('refunds:read')
  @Get('refunds')
  listRefunds(@Query() query: RefundsQueryDto) {
    return this.read.listRefunds(query);
  }

  @RequireScope('refunds:read')
  @Get('refunds/:refundNumber')
  getRefund(@Param('refundNumber') refundNumber: string) {
    return this.read.getRefund(refundNumber);
  }
}
