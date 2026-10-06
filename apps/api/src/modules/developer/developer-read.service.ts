import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { normalizePhone } from '../../common/phone';
import { Category, CategoryDocument } from '../catalog/schemas/category.schema';
import { Product, ProductDocument } from '../catalog/schemas/product.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { StockMovement, StockMovementDocument } from '../inventory/schemas/stock-movement.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Refund, RefundDocument } from '../refunds/schemas/refund.schema';
import { ReturnRequest, ReturnRequestDocument } from '../returns/schemas/return.schema';
import { ApiError } from './api-error';
import { decodeCursor, encodeCursor, pageSize, parsePrefixedId } from './developer-api';
import {
  categoryResource,
  customerResource,
  inventoryResource,
  orderResource,
  paymentResource,
  productResource,
  refundResource,
  returnResource,
  stockMovementResource,
} from './resources';

type Filter = Record<string, unknown>;

interface PageQuery {
  limit?: number;
  cursor?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function notFound(resource: string, label: string): ApiError {
  return new ApiError(404, `${resource}_not_found`, `No ${label} with that id exists.`);
}

/**
 * Everything the Developer API reads. It only reads: nothing here can
 * change an order, a price or a stock level.
 *
 * Every collection is paged the same way: newest first, `limit` records
 * at a time (25 unless asked, 100 at most), and an opaque `next_cursor`
 * to pass back for the following page.
 */
@Injectable()
export class DeveloperReadService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categories: Model<CategoryDocument>,
    @InjectModel(Inventory.name) private readonly inventory: Model<InventoryDocument>,
    @InjectModel(StockMovement.name) private readonly movements: Model<StockMovementDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly payments: Model<PaymentDocument>,
    @InjectModel(ReturnRequest.name) private readonly returns: Model<ReturnRequestDocument>,
    @InjectModel(Refund.name) private readonly refunds: Model<RefundDocument>,
  ) {}

  private async page(
    model: Model<any>,
    filter: Filter,
    query: PageQuery,
    shape: (record: any) => unknown,
    populate?: string,
  ) {
    const limit = pageSize(query.limit);
    let after: string | null = null;

    if (query.cursor !== undefined && query.cursor !== '') {
      after = decodeCursor(query.cursor);

      if (!after) {
        throw new ApiError(
          400,
          'invalid_cursor',
          'The cursor is not valid. Pass the next_cursor of the previous page unchanged.',
        );
      }
    }

    const conditions: Filter = after
      ? { $and: [filter, { _id: { $lt: new Types.ObjectId(after) } }] }
      : filter;

    // One more than asked for, to know whether another page follows.
    let find: any = model.find(conditions).sort({ _id: -1 }).limit(limit + 1);

    if (populate) {
      find = find.populate(populate, 'name slug');
    }

    const found: any[] = await find.lean();
    const hasMore = found.length > limit;
    const records = hasMore ? found.slice(0, limit) : found;
    const last = records[records.length - 1];

    return {
      data: records.map(shape),
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: hasMore && last ? encodeCursor(last._id) : null,
      },
    };
  }

  /* ---------------------------------------------------------------- */
  /* Catalog                                                           */
  /* ---------------------------------------------------------------- */

  async listProducts(query: PageQuery & { q?: string; category?: string; brand?: string; active?: boolean }) {
    const filter: Filter = {};

    if (query.active !== undefined) {
      filter.active = query.active;
    }

    if (query.brand?.trim()) {
      filter.brand = new RegExp(`^${escapeRegex(query.brand.trim())}$`, 'i');
    }

    if (query.category?.trim()) {
      const category = await this.categories
        .findOne({ slug: query.category.trim().toLowerCase() })
        .select({ _id: 1 })
        .lean();

      if (!category) {
        throw new ApiError(404, 'category_not_found', 'No category with that id exists.');
      }

      filter.category = category._id;
    }

    if (query.q?.trim()) {
      const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');

      filter.$or = [
        { name: pattern },
        { brand: pattern },
        { productCode: pattern },
        { 'variants.sku': pattern },
      ];
    }

    return this.page(this.products as Model<any>, filter, query, productResource, 'category');
  }

  async getProduct(productId: string) {
    const product = await this.products
      .findOne({ productCode: String(productId).trim().toUpperCase() })
      .populate('category', 'name slug')
      .lean();

    if (!product) {
      throw notFound('product', 'product');
    }

    return { data: productResource(product) };
  }

  async listCategories() {
    const categories = await this.categories.find({}).sort({ name: 1 }).lean();

    return { data: categories.map(categoryResource) };
  }

  /* ---------------------------------------------------------------- */
  /* Inventory                                                         */
  /* ---------------------------------------------------------------- */

  async listInventory(query: PageQuery & { sku?: string; low_stock?: boolean }) {
    const filter: Filter = {};

    if (query.sku?.trim()) {
      const skus = query.sku
        .split(',')
        .map((sku) => sku.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 100);

      filter.sku = { $in: skus };
    }

    if (query.low_stock === true) {
      filter.$expr = { $lte: ['$onHand', '$reorderLevel'] };
    }

    return this.page(this.inventory as Model<any>, filter, query, inventoryResource);
  }

  async getInventory(sku: string) {
    const record = await this.inventory.findOne({ sku: String(sku).trim().toUpperCase() }).lean();

    if (!record) {
      throw new ApiError(404, 'inventory_not_found', 'No stock record exists for that SKU.');
    }

    return { data: inventoryResource(record) };
  }

  async listStockMovements(sku: string, query: PageQuery) {
    const normalized = String(sku).trim().toUpperCase();

    // A SKU nobody has stock for is an error, not an empty history.
    await this.getInventory(normalized);

    return this.page(this.movements as Model<any>, { sku: normalized }, query, stockMovementResource);
  }

  /* ---------------------------------------------------------------- */
  /* Customers                                                         */
  /* ---------------------------------------------------------------- */

  async listCustomers(query: PageQuery & { phone?: string; email?: string }) {
    const filter: Filter = {};

    if (query.phone?.trim()) {
      // Stored in one format, so "+880 1711…" and "01711…" find the same customer.
      filter.phone = normalizePhone(query.phone);
    }

    if (query.email?.trim()) {
      filter.email = query.email.trim().toLowerCase();
    }

    return this.page(this.customers as Model<any>, filter, query, customerResource);
  }

  private customerObjectId(customerId: string): Types.ObjectId {
    const id = parsePrefixedId('cus', customerId);

    if (!id) {
      throw notFound('customer', 'customer');
    }

    return new Types.ObjectId(id);
  }

  async getCustomer(customerId: string) {
    const customer = await this.customers.findById(this.customerObjectId(customerId)).lean();

    if (!customer) {
      throw notFound('customer', 'customer');
    }

    return { data: customerResource(customer) };
  }

  async listCustomerOrders(customerId: string, query: PageQuery) {
    const id = this.customerObjectId(customerId);
    const exists = await this.customers.exists({ _id: id });

    if (!exists) {
      throw notFound('customer', 'customer');
    }

    return this.page(this.orders as Model<any>, { customerId: id }, query, orderResource);
  }

  /* ---------------------------------------------------------------- */
  /* Orders                                                            */
  /* ---------------------------------------------------------------- */

  async listOrders(
    query: PageQuery & {
      status?: string;
      payment_status?: string;
      customer_id?: string;
      phone?: string;
      created_after?: string;
      created_before?: string;
    },
  ) {
    const filter: Filter = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.payment_status) {
      filter.paymentStatus = query.payment_status;
    }

    if (query.customer_id) {
      const id = parsePrefixedId('cus', query.customer_id);

      if (!id) {
        throw new ApiError(422, 'validation_failed', 'One or more parameters are not valid.', [
          'customer_id must be a customer id such as cus_66f0a1b2c3d4e5f6a7b8c9d0',
        ]);
      }

      filter.customerId = new Types.ObjectId(id);
    }

    if (query.phone?.trim()) {
      filter['customer.phone'] = normalizePhone(query.phone);
    }

    const created: Record<string, Date> = {};

    if (query.created_after) {
      created.$gt = new Date(query.created_after);
    }

    if (query.created_before) {
      created.$lt = new Date(query.created_before);
    }

    if (Object.keys(created).length > 0) {
      filter.createdAt = created;
    }

    return this.page(this.orders as Model<any>, filter, query, orderResource);
  }

  async getOrder(orderNumber: string) {
    const order = await this.orders
      .findOne({ orderNumber: String(orderNumber).trim().toUpperCase() })
      .lean();

    if (!order) {
      throw notFound('order', 'order');
    }

    return { data: orderResource(order) };
  }

  /* ---------------------------------------------------------------- */
  /* Payments                                                          */
  /* ---------------------------------------------------------------- */

  async listPayments(query: PageQuery & { order_id?: string; status?: string }) {
    const filter: Filter = {};

    if (query.order_id?.trim()) {
      filter.orderNumber = query.order_id.trim().toUpperCase();
    }

    if (query.status) {
      filter.status = query.status;
    }

    return this.page(this.payments as Model<any>, filter, query, paymentResource);
  }

  async getPayment(paymentId: string) {
    const id = parsePrefixedId('pay', paymentId);
    const payment = id ? await this.payments.findById(new Types.ObjectId(id)).lean() : null;

    if (!payment) {
      throw notFound('payment', 'payment');
    }

    return { data: paymentResource(payment) };
  }

  /* ---------------------------------------------------------------- */
  /* Returns and refunds                                               */
  /* ---------------------------------------------------------------- */

  async listReturns(query: PageQuery & { order_id?: string; status?: string }) {
    const filter: Filter = {};

    if (query.order_id?.trim()) {
      filter.orderNumber = query.order_id.trim().toUpperCase();
    }

    if (query.status) {
      filter.status = query.status;
    }

    return this.page(this.returns as Model<any>, filter, query, returnResource);
  }

  async getReturn(returnNumber: string) {
    const request = await this.returns
      .findOne({ returnNumber: String(returnNumber).trim().toUpperCase() })
      .lean();

    if (!request) {
      throw notFound('return', 'return');
    }

    return { data: returnResource(request) };
  }

  async listRefunds(query: PageQuery & { order_id?: string; return_id?: string; status?: string }) {
    const filter: Filter = {};

    if (query.order_id?.trim()) {
      filter.orderNumber = query.order_id.trim().toUpperCase();
    }

    if (query.return_id?.trim()) {
      filter.returnNumber = query.return_id.trim().toUpperCase();
    }

    if (query.status) {
      filter.status = query.status;
    }

    return this.page(this.refunds as Model<any>, filter, query, refundResource);
  }

  async getRefund(refundNumber: string) {
    const refund = await this.refunds
      .findOne({ refundNumber: String(refundNumber).trim().toUpperCase() })
      .lean();

    if (!refund) {
      throw notFound('refund', 'refund');
    }

    return { data: refundResource(refund) };
  }
}
