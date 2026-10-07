import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { RedisService } from '../../infrastructure/redis/redis.service';
import { CatalogService } from '../catalog/catalog.service';
import { Product, ProductDocument } from '../catalog/schemas/product.schema';
import { CustomersService } from '../customers/customers.service';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { RefundsService } from '../refunds/refunds.service';
import { Refund, RefundDocument } from '../refunds/schemas/refund.schema';
import { ReturnsService } from '../returns/returns.service';
import { ReturnRequest, ReturnRequestDocument } from '../returns/schemas/return.schema';
import { ApiError } from './api-error';
import { parsePrefixedId } from './developer-api';
import {
  customerResource,
  inventoryResource,
  orderResource,
  productResource,
  refundResource,
  returnResource,
} from './resources';

/** Who is making a change through the Developer API, for the record. */
export interface WriteOrigin {
  appId: string;
  appName: string;
  requestId: string;
}

function messageOf(error: HttpException): string {
  const body = error.getResponse();
  const message = typeof body === 'object' && body !== null ? (body as { message?: unknown }).message : body;

  return Array.isArray(message) ? message.join(', ') : String(message ?? '');
}

/**
 * Everything the Developer API changes.
 *
 * It decides nothing new about commerce. Each change goes through the
 * same service the admin uses, so the same rules apply: which status may
 * follow which, when stock is returned, what can be returned and for how
 * much. This layer only checks what the caller expected, calls that
 * service, and turns its refusals into the API's error codes.
 */
@Injectable()
export class DeveloperWriteService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(ReturnRequest.name) private readonly returnModel: Model<ReturnRequestDocument>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<InventoryDocument>,
    private readonly orders: OrdersService,
    private readonly returns: ReturnsService,
    private readonly inventory: InventoryService,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Refund.name) private readonly refundModel: Model<RefundDocument>,
    private readonly catalog: CatalogService,
    private readonly customers: CustomersService,
    private readonly refunds: RefundsService,
    private readonly redis: RedisService,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Orders                                                            */
  /* ---------------------------------------------------------------- */

  private async currentOrder(orderNumber: string) {
    const order = await this.orderModel
      .findOne({ orderNumber: String(orderNumber).trim().toUpperCase() })
      .lean();

    if (!order) {
      throw new ApiError(404, 'order_not_found', 'No order with that id exists.');
    }

    return order;
  }

  private expect(resource: string, expected: string | undefined, current: string): void {
    if (expected !== undefined && expected !== current) {
      throw new ApiError(
        409,
        'state_conflict',
        `The ${resource} is "${current}", not "${expected}" as expected. Read it again and decide what to do.`,
        { expected_status: expected, current_status: current },
      );
    }
  }

  private async changeOrder(
    orderNumber: string,
    status: string,
    trackingNumber: string | undefined,
    origin: WriteOrigin,
    refusedCode: string,
  ) {
    try {
      const updated = await this.orders.updateStatus(
        orderNumber,
        { status, ...(trackingNumber === undefined ? {} : { trackingNumber }) },
        origin.appName,
        { actorType: 'api_application', actorId: origin.appId, requestId: origin.requestId },
      );

      return { data: orderResource(updated as any) };
    } catch (error) {
      if (error instanceof ApiError || !(error instanceof HttpException)) {
        throw error;
      }

      const message = messageOf(error);

      if (error.getStatus() === 404) {
        throw new ApiError(404, 'order_not_found', 'No order with that id exists.');
      }

      if (/payment has not been received/.test(message)) {
        throw new ApiError(
          409,
          'payment_required',
          'This order is to be paid online and the payment has not been received. It can be cancelled, but not moved forward.',
        );
      }

      if (/^Cannot move order/.test(message)) {
        throw new ApiError(409, refusedCode, `${message}.`);
      }

      throw error;
    }
  }

  /**
   * Cancels an order and returns its stock. Cancelling an order that is
   * already cancelled succeeds and changes nothing. An order that was
   * paid online stays "paid": cancelling does not send the money back.
   */
  async cancelOrder(orderNumber: string, body: { expected_status?: string }, origin: WriteOrigin) {
    const current = await this.currentOrder(orderNumber);

    this.expect('order', body.expected_status, current.status);

    if (current.status === 'cancelled') {
      return { data: orderResource(current) };
    }

    if (current.status === 'shipped' || current.status === 'delivered') {
      throw new ApiError(
        409,
        'order_not_cancellable',
        `The order cannot be cancelled because it is ${current.status}.`,
        { current_status: current.status },
      );
    }

    return this.changeOrder(current.orderNumber, 'cancelled', undefined, origin, 'order_not_cancellable');
  }

  /** Moves an order forward: confirmed, processing, shipped, delivered. Can set the tracking number. */
  async setOrderStatus(
    orderNumber: string,
    body: { status: string; tracking_number?: string; expected_status?: string },
    origin: WriteOrigin,
  ) {
    const current = await this.currentOrder(orderNumber);

    this.expect('order', body.expected_status, current.status);

    return this.changeOrder(
      current.orderNumber,
      body.status,
      body.tracking_number?.trim(),
      origin,
      'invalid_transition',
    );
  }

  /* ---------------------------------------------------------------- */
  /* Returns                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Opens a return for a delivered order. The server decides what is
   * eligible and what the refund would be; the caller only says which
   * SKUs and how many.
   */
  async createReturn(body: {
    order_id: string;
    items: Array<{ sku: string; quantity: number }>;
    reason: string;
    details?: string;
  }) {
    const order = await this.currentOrder(body.order_id);

    try {
      const created: any = await this.returns.create({
        orderNumber: order.orderNumber,
        // The application is trusted with returns; the customer's phone is not asked of it.
        phone: order.customer.phone,
        items: body.items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
        reason: body.reason.trim(),
        details: body.details?.trim(),
      });

      return { data: returnResource(typeof created?.toObject === 'function' ? created.toObject() : created) };
    } catch (error) {
      if (error instanceof ApiError || !(error instanceof HttpException)) {
        throw error;
      }

      const message = messageOf(error);
      const status = error.getStatus();

      if (status === 404) {
        throw new ApiError(404, 'order_not_found', 'No order with that id exists.');
      }

      if (status === 409) {
        throw new ApiError(409, 'resource_busy', 'Another return for this order is being processed. Retry in a moment.');
      }

      if (/only be requested after delivery/.test(message)) {
        throw new ApiError(409, 'return_not_eligible', 'A return can only be opened after the order is delivered.', {
          current_status: order.status,
        });
      }

      if (/remain eligible for return/.test(message)) {
        throw new ApiError(409, 'return_quantity_exceeded', `${message}.`);
      }

      if (/is not part of this order/.test(message)) {
        throw new ApiError(422, 'return_not_eligible', `${message}.`);
      }

      if (/Duplicate return SKU/.test(message)) {
        throw new ApiError(422, 'validation_failed', 'One or more parameters are not valid.', [
          'items must not list the same sku twice',
        ]);
      }

      throw error;
    }
  }

  /** Moves a return on: approved or rejected, then received, then completed. */
  async setReturnStatus(returnNumber: string, body: { status: string; expected_status?: string }) {
    const normalized = String(returnNumber).trim().toUpperCase();
    const current = await this.returnModel.findOne({ returnNumber: normalized }).lean();

    if (!current) {
      throw new ApiError(404, 'return_not_found', 'No return with that id exists.');
    }

    this.expect('return', body.expected_status, current.status);

    if (current.status === body.status) {
      // Already there: a repeat of the same request changes nothing.
      return { data: returnResource(current) };
    }

    try {
      const updated = await this.returns.updateStatus(normalized, { status: body.status });

      return { data: returnResource(updated as any) };
    } catch (error) {
      if (error instanceof ApiError || !(error instanceof HttpException)) {
        throw error;
      }

      const message = messageOf(error);
      const status = error.getStatus();

      if (status === 404) {
        throw new ApiError(404, 'return_not_found', 'No return with that id exists.');
      }

      if (status === 409) {
        throw new ApiError(409, 'resource_busy', 'This return is being updated by someone else. Retry in a moment.');
      }

      if (/^Cannot move return/.test(message)) {
        throw new ApiError(409, 'invalid_transition', `${message}.`, { current_status: current.status });
      }

      throw error;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Inventory                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Adds to or takes from the stock of one SKU, and writes a movement
   * to its history. The stock can never go below what is reserved.
   */
  async adjustInventory(
    sku: string,
    body: { delta: number; reason: string; reference?: string },
    origin: WriteOrigin,
    idempotencyKey: string,
  ) {
    const normalized = String(sku).trim().toUpperCase();

    try {
      await this.inventory.adjust(normalized, {
        delta: body.delta,
        reason: body.reason.trim(),
        reference: body.reference?.trim() || `api:${origin.appId}`,
        // The stock movement carries the key too, so even a repeat that slips through is applied once.
        idempotencyKey: `api:${origin.appId}:${idempotencyKey}`,
      });
    } catch (error) {
      if (error instanceof ApiError || !(error instanceof HttpException)) {
        throw error;
      }

      const message = messageOf(error);

      if (error.getStatus() === 404) {
        /*
         * No stock record. If the SKU is a real variant that simply
         * never had one, start it at zero and apply the adjustment;
         * otherwise there is nothing to adjust.
         */
        return this.adjustFromNothing(normalized, body, origin, idempotencyKey);
      }

      if (/Insufficient available stock/.test(message)) {
        throw new ApiError(409, 'insufficient_inventory', 'There is not enough available stock for this adjustment.');
      }

      throw error;
    }

    return this.levelOf(normalized);
  }

  private async levelOf(sku: string) {
    const level = await this.inventoryModel.findOne({ sku }).lean();

    if (!level) {
      throw new ApiError(404, 'inventory_not_found', 'No stock record exists for that SKU.');
    }

    return { data: inventoryResource(level) };
  }

  private async adjustFromNothing(
    sku: string,
    body: { delta: number; reason: string; reference?: string },
    origin: WriteOrigin,
    idempotencyKey: string,
  ) {
    const exists = await this.productModel.exists({ 'variants.sku': sku });

    if (!exists) {
      throw new ApiError(404, 'inventory_not_found', 'No stock record exists for that SKU.');
    }

    if (body.delta < 0) {
      throw new ApiError(409, 'insufficient_inventory', 'There is not enough available stock for this adjustment.');
    }

    await this.inventory.upsert(sku, { onHand: 0 });

    await this.inventory.adjust(sku, {
      delta: body.delta,
      reason: body.reason.trim(),
      reference: body.reference?.trim() || `api:${origin.appId}`,
      idempotencyKey: `api:${origin.appId}:${idempotencyKey}`,
    });

    return this.levelOf(sku);
  }

  /* ---------------------------------------------------------------- */
  /* Products                                                          */
  /* ---------------------------------------------------------------- */

  private async productByCode(productId: string) {
    const product = await this.productModel
      .findOne({ productCode: String(productId).trim().toUpperCase() })
      .lean();

    if (!product) {
      throw new ApiError(404, 'product_not_found', 'No product with that id exists.');
    }

    return product;
  }

  /** Turns the catalog's refusals into the API's error codes. Always throws. */
  private catalogRefusal(error: unknown): never {
    if (error instanceof ApiError || !(error instanceof HttpException)) {
      throw error;
    }

    const message = messageOf(error);
    const status = error.getStatus();

    if (/^Category ".*" does not exist/.test(message)) {
      throw new ApiError(422, 'category_not_found', 'No category with that id exists.');
    }

    if (/is already used by another product/.test(message)) {
      throw new ApiError(409, 'sku_conflict', message.split('. ')[0] + '.');
    }

    if (/at the same moment/.test(message)) {
      throw new ApiError(409, 'resource_busy', 'Another product was being saved at the same moment. Retry.');
    }

    if (status === 404) {
      throw new ApiError(404, 'product_not_found', 'No product with that id exists.');
    }

    if (status === 409) {
      throw new ApiError(409, 'conflict', message);
    }

    if (status === 400) {
      throw new ApiError(422, 'validation_failed', 'One or more parameters are not valid.', [message]);
    }

    throw error;
  }

  private variantInput(variant: {
    sku?: string;
    title: string;
    price: number;
    compare_at_price?: number | null;
    attributes?: Record<string, string>;
    active?: boolean;
  }) {
    return {
      ...(variant.sku?.trim() ? { sku: variant.sku.trim() } : {}),
      title: variant.title.trim(),
      price: variant.price,
      ...(variant.compare_at_price === undefined || variant.compare_at_price === null
        ? {}
        : { compareAtPrice: variant.compare_at_price }),
      attributes: variant.attributes ?? {},
      active: variant.active !== false,
    };
  }

  /** The variants of a stored product, in the form the catalog takes them back. */
  private storedVariants(product: { variants: any[] }) {
    return product.variants.map((variant) => ({
      sku: String(variant.sku),
      title: String(variant.title),
      price: Number(variant.price),
      ...(variant.compareAtPrice === undefined || variant.compareAtPrice === null
        ? {}
        : { compareAtPrice: Number(variant.compareAtPrice) }),
      attributes: (variant.attributes ?? {}) as Record<string, string>,
      active: variant.active !== false,
    }));
  }

  /*
   * A new SKU gets a stock record at once, so its stock can be read and
   * adjusted straight away. The product is already saved at this point:
   * a failure here is logged and not passed on, because failing the
   * request would invite a retry that creates the product twice. A SKU
   * left without a record gets one on its first stock adjustment.
   */
  private async openStock(entries: Array<{ sku: string; opening: number }>): Promise<void> {
    for (const entry of entries) {
      try {
        await this.inventory.upsert(entry.sku, { onHand: entry.opening });
      } catch (error) {
        console.error('[developer-api] stock record not created for', entry.sku, error);
      }
    }
  }

  /** Creates a product. The server issues the product code and any SKU left out. */
  async createProduct(body: {
    name: string;
    description?: string;
    brand?: string;
    category: string;
    images?: string[];
    active?: boolean;
    variants: Array<{
      sku?: string;
      title: string;
      price: number;
      compare_at_price?: number;
      attributes?: Record<string, string>;
      active?: boolean;
      opening_stock?: number;
    }>;
  }) {
    let product: any;

    try {
      product = await this.catalog.createProduct({
        name: body.name.trim(),
        ...(body.description === undefined ? {} : { description: body.description }),
        ...(body.brand === undefined ? {} : { brand: body.brand.trim() }),
        category: body.category.trim(),
        ...(body.images === undefined ? {} : { images: body.images }),
        ...(body.active === undefined ? {} : { active: body.active }),
        variants: body.variants.map((variant) => this.variantInput(variant)),
      });
    } catch (error) {
      this.catalogRefusal(error);
    }

    // The catalog keeps the variants in the order they were sent.
    await this.openStock(
      (product.variants ?? []).map((variant: any, index: number) => ({
        sku: String(variant.sku),
        opening: body.variants[index]?.opening_stock ?? 0,
      })),
    );

    return { data: productResource(product) };
  }

  /** Changes a product's own fields. Variants and prices have their own endpoints. */
  async updateProduct(
    productId: string,
    body: {
      name?: string;
      description?: string;
      brand?: string;
      category?: string;
      images?: string[];
      active?: boolean;
    },
  ) {
    const fields: {
      name?: string;
      description?: string;
      brand?: string;
      category?: string;
      images?: string[];
      active?: boolean;
    } = {
      ...(body.name === undefined ? {} : { name: body.name.trim() }),
      ...(body.description === undefined ? {} : { description: body.description }),
      ...(body.brand === undefined ? {} : { brand: body.brand.trim() }),
      ...(body.category === undefined ? {} : { category: body.category.trim() }),
      ...(body.images === undefined ? {} : { images: body.images }),
      ...(body.active === undefined ? {} : { active: body.active }),
    };

    if (Object.keys(fields).length === 0) {
      throw new ApiError(422, 'validation_failed', 'One or more parameters are not valid.', [
        'send at least one field to change',
      ]);
    }

    const product = await this.productByCode(productId);

    try {
      const updated = await this.catalog.updateProduct(String(product._id), fields);

      return { data: productResource(updated as any) };
    } catch (error) {
      this.catalogRefusal(error);
    }
  }

  /*
   * Variants are stored as one list on the product, so changing one is
   * "read the list, change it, write it back". Two such changes at the
   * same moment would lose one of them; a short lock per product makes
   * the second wait its turn by asking the caller to retry.
   */
  private async withProductLock<T>(productCode: string, work: () => Promise<T>): Promise<T> {
    const key = `developer-product:${productCode}`;
    const token = await this.redis.acquireLock(key, 15000);

    if (!token) {
      throw new ApiError(409, 'resource_busy', 'This product is being changed by someone else. Retry in a moment.');
    }

    try {
      return await work();
    } finally {
      await this.redis.releaseLock(key, token).catch(() => undefined);
    }
  }

  /** Adds a variant to a product. Existing variants are left exactly as they are. */
  async addVariant(
    productId: string,
    body: {
      sku?: string;
      title: string;
      price: number;
      compare_at_price?: number;
      attributes?: Record<string, string>;
      active?: boolean;
      opening_stock?: number;
    },
  ) {
    const code = String(productId).trim().toUpperCase();

    return this.withProductLock(code, async () => {
      const product = await this.productByCode(code);
      const before = new Set(product.variants.map((variant) => String(variant.sku)));

      let updated: any;

      try {
        updated = await this.catalog.updateProduct(String(product._id), {
          variants: [...this.storedVariants(product), this.variantInput(body)],
        });
      } catch (error) {
        this.catalogRefusal(error);
      }

      const added = (updated.variants ?? []).find((variant: any) => !before.has(String(variant.sku)));

      if (added) {
        await this.openStock([{ sku: String(added.sku), opening: body.opening_stock ?? 0 }]);
      }

      return { data: productResource(updated) };
    });
  }

  /** Changes one variant: its title, price, compare-at price, attributes or whether it is on sale. The SKU never changes. */
  async updateVariant(
    productId: string,
    sku: string,
    body: {
      title?: string;
      price?: number;
      compare_at_price?: number | null;
      attributes?: Record<string, string>;
      active?: boolean;
    },
  ) {
    if (
      body.title === undefined &&
      body.price === undefined &&
      body.compare_at_price === undefined &&
      body.attributes === undefined &&
      body.active === undefined
    ) {
      throw new ApiError(422, 'validation_failed', 'One or more parameters are not valid.', [
        'send at least one field to change',
      ]);
    }

    const code = String(productId).trim().toUpperCase();
    const target = String(sku).trim().toUpperCase();

    return this.withProductLock(code, async () => {
      const product = await this.productByCode(code);

      if (!product.variants.some((variant) => String(variant.sku) === target)) {
        throw new ApiError(404, 'variant_not_found', 'This product has no variant with that SKU.');
      }

      const variants = this.storedVariants(product).map((variant) => {
        if (variant.sku !== target) {
          return variant;
        }

        const { compareAtPrice, ...rest } = variant as typeof variant & { compareAtPrice?: number };

        const nextCompare =
          body.compare_at_price === undefined
            ? compareAtPrice
            : body.compare_at_price === null
              ? undefined
              : body.compare_at_price;

        return {
          ...rest,
          ...(body.title === undefined ? {} : { title: body.title.trim() }),
          ...(body.price === undefined ? {} : { price: body.price }),
          ...(body.attributes === undefined ? {} : { attributes: body.attributes }),
          ...(body.active === undefined ? {} : { active: body.active }),
          ...(nextCompare === undefined ? {} : { compareAtPrice: nextCompare }),
        };
      });

      try {
        const updated = await this.catalog.updateProduct(String(product._id), { variants });

        return { data: productResource(updated as any) };
      } catch (error) {
        this.catalogRefusal(error);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Customers                                                         */
  /* ---------------------------------------------------------------- */

  private customerObjectId(customerId: string): string {
    const id = parsePrefixedId('cus', customerId);

    if (!id) {
      throw new ApiError(404, 'customer_not_found', 'No customer with that id exists.');
    }

    return id;
  }

  private customerRefusal(error: unknown): never {
    if (error instanceof HttpException && !(error instanceof ApiError) && error.getStatus() === 404) {
      throw new ApiError(404, 'customer_not_found', 'No customer with that id exists.');
    }

    throw error;
  }

  /** Changes a customer's name or email. The phone number identifies the customer and cannot be changed here. */
  async updateCustomer(customerId: string, body: { name?: string; email?: string }) {
    if (body.name === undefined && body.email === undefined) {
      throw new ApiError(422, 'validation_failed', 'One or more parameters are not valid.', [
        'send at least one field to change',
      ]);
    }

    const id = this.customerObjectId(customerId);

    try {
      const updated = await this.customers.updateProfile(id, {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.email === undefined ? {} : { email: body.email }),
      });

      return { data: customerResource(updated as any) };
    } catch (error) {
      this.customerRefusal(error);
    }
  }

  /** Saves an address for a customer. The delivery zone follows from the district. */
  async addCustomerAddress(
    customerId: string,
    body: {
      label: string;
      address_line1: string;
      address_line2?: string;
      district: string;
      area?: string;
      postal_code?: string;
      is_default?: boolean;
    },
  ) {
    const id = this.customerObjectId(customerId);

    try {
      const updated = await this.customers.addAddress(id, {
        label: body.label,
        addressLine1: body.address_line1,
        addressLine2: body.address_line2,
        city: body.district,
        area: body.area,
        postalCode: body.postal_code,
        isDefault: body.is_default === true,
      });

      return { data: customerResource(updated as any) };
    } catch (error) {
      this.customerRefusal(error);
    }
  }

  /** Removes a saved address. Orders already placed keep their own copy of the address. */
  async removeCustomerAddress(customerId: string, addressId: string) {
    const id = this.customerObjectId(customerId);
    const customer = await this.customerModel.findById(id).lean();

    if (!customer) {
      throw new ApiError(404, 'customer_not_found', 'No customer with that id exists.');
    }

    if (!(customer.addresses ?? []).some((address: any) => address.id === addressId)) {
      throw new ApiError(404, 'address_not_found', 'This customer has no saved address with that id.');
    }

    try {
      const updated = await this.customers.removeAddress(id, addressId);

      return { data: customerResource(updated as any) };
    } catch (error) {
      this.customerRefusal(error);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Refunds                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Records how a refund turned out. It does not send any money: the
   * refund itself is made at the payment gateway or in cash, and this
   * keeps the shop's record in step with what really happened.
   */
  async setRefundStatus(
    refundNumber: string,
    body: { status: string; note?: string; expected_status?: string },
  ) {
    const normalized = String(refundNumber).trim().toUpperCase();
    const current = await this.refundModel.findOne({ refundNumber: normalized }).lean();

    if (!current) {
      throw new ApiError(404, 'refund_not_found', 'No refund with that id exists.');
    }

    this.expect('refund', body.expected_status, current.status);

    if (current.status === body.status && body.note === undefined) {
      return { data: refundResource(current) };
    }

    // A completed refund is final. A failed one can be tried again or completed.
    const next: Record<string, string[]> = {
      pending: ['completed', 'failed'],
      failed: ['completed', 'pending'],
      completed: [],
    };

    if (current.status !== body.status && !(next[current.status] ?? []).includes(body.status)) {
      throw new ApiError(
        409,
        'invalid_transition',
        `Cannot move refund from ${current.status} to ${body.status}.`,
        { current_status: current.status },
      );
    }

    try {
      const updated = await this.refunds.update(normalized, {
        status: body.status,
        ...(body.note === undefined ? {} : { note: body.note.trim() }),
      });

      return { data: refundResource(updated as any) };
    } catch (error) {
      if (error instanceof HttpException && !(error instanceof ApiError) && error.getStatus() === 404) {
        throw new ApiError(404, 'refund_not_found', 'No refund with that id exists.');
      }

      throw error;
    }
  }
}
