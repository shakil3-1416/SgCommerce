import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { ReturnsService } from '../returns/returns.service';
import { ReturnRequest, ReturnRequestDocument } from '../returns/schemas/return.schema';
import { ApiError } from './api-error';
import { inventoryResource, orderResource, returnResource } from './resources';

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
        throw new ApiError(404, 'inventory_not_found', 'No stock record exists for that SKU.');
      }

      if (/Insufficient available stock/.test(message)) {
        throw new ApiError(409, 'insufficient_inventory', 'There is not enough available stock for this adjustment.');
      }

      throw error;
    }

    const level = await this.inventoryModel.findOne({ sku: normalized }).lean();

    if (!level) {
      throw new ApiError(404, 'inventory_not_found', 'No stock record exists for that SKU.');
    }

    return { data: inventoryResource(level) };
  }
}
