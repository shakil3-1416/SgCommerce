import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { Category, CategorySchema } from '../catalog/schemas/category.schema';
import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { CustomersModule } from '../customers/customers.module';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { StockMovement, StockMovementSchema } from '../inventory/schemas/stock-movement.schema';
import { OrdersModule } from '../orders/orders.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { RefundsModule } from '../refunds/refunds.module';
import { Refund, RefundSchema } from '../refunds/schemas/refund.schema';
import { ReturnsModule } from '../returns/returns.module';
import { ReturnRequest, ReturnRequestSchema } from '../returns/schemas/return.schema';
import { ApiApplicationsService } from './api-applications.service';
import { ApiKeyGuard } from './api-key.guard';
import { ApiRequestLogService } from './api-request-log.service';
import { DeveloperApplicationsController } from './developer-applications.controller';
import { DeveloperController } from './developer.controller';
import { DeveloperReadService } from './developer-read.service';
import { DeveloperWriteController } from './developer-write.controller';
import { DeveloperWriteService } from './developer-write.service';
import { IdempotencyService } from './idempotency.service';
import { ApiApplication, ApiApplicationSchema } from './schemas/api-application.schema';
import { ApiIdempotency, ApiIdempotencySchema } from './schemas/api-idempotency.schema';
import {
  ApiRequestLog,
  ApiRequestLogSchema,
  ApiUsage,
  ApiUsageSchema,
} from './schemas/api-request-log.schema';

/*
 * The Developer API: applications, their credentials and scopes, and the
 * external contract under /api/v1/developer.
 *
 * It reads the commerce collections through the same schemas the rest of
 * the API uses, and makes changes only through the services the admin
 * uses (orders, returns, inventory, catalog, customers, refunds), so
 * the same rules apply to both.
 * It adds nothing to the endpoints the shop and the admin call.
 */
@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => OrdersModule),
    ReturnsModule,
    InventoryModule,
    CatalogModule,
    CustomersModule,
    RefundsModule,
    MongooseModule.forFeature([
      { name: ApiApplication.name, schema: ApiApplicationSchema },
      { name: ApiRequestLog.name, schema: ApiRequestLogSchema },
      { name: ApiUsage.name, schema: ApiUsageSchema },
      { name: ApiIdempotency.name, schema: ApiIdempotencySchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: ReturnRequest.name, schema: ReturnRequestSchema },
      { name: Refund.name, schema: RefundSchema },
    ]),
  ],
  controllers: [DeveloperController, DeveloperWriteController, DeveloperApplicationsController],
  providers: [
    ApiApplicationsService,
    ApiRequestLogService,
    DeveloperReadService,
    DeveloperWriteService,
    IdempotencyService,
    ApiKeyGuard,
  ],
})
export class DeveloperModule {}
