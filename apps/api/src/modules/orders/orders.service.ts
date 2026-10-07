import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  CatalogService,
} from '../catalog/catalog.service';

import {
  CustomersService,
} from '../customers/customers.service';

import {
  InventoryService,
} from '../inventory/inventory.service';

import {
  PlaceOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

import {
  SequencesService,
} from '../sequences/sequences.service';

import {
  deliveryZoneFor,
} from '../../common/delivery-zone';

import {
  isWithinOnlinePaymentLimits,
  ONLINE_PAYMENT_MAXIMUM,
  ONLINE_PAYMENT_MINIMUM,
} from '../payments/sslcommerz';

import {
  Order,
  OrderDocument,
} from './schemas/order.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel:
      Model<OrderDocument>,

    private readonly catalog:
      CatalogService,

    private readonly inventory:
      InventoryService,

    private readonly customers:
      CustomersService,

    private readonly sequences:
      SequencesService,
  ) {}

  private shippingFee(
    zone: string,
  ) {
    return zone ===
      'inside_dhaka'
      ? 80
      : 150;
  }

  async placeOrder(
    dto: PlaceOrderDto,
    idempotencyKey?: string,
    customerId?: string,
  ) {
    const normalizedIdempotencyKey =
      idempotencyKey
        ?.trim()
        .slice(0, 200) ||
      undefined;

    if (
      normalizedIdempotencyKey
    ) {
      const existing =
        await this.orderModel
          .findOne({
            idempotencyKey:
              normalizedIdempotencyKey,
          })
          .lean();

      if (existing) {
        return existing;
      }
    }

    const uniqueSkus =
      new Set(
        dto.items.map(
          (item) =>
            item.sku
              .trim()
              .toUpperCase(),
        ),
      );

    if (
      uniqueSkus.size !==
      dto.items.length
    ) {
      throw new BadRequestException(
        'Duplicate SKU entries are not allowed',
      );
    }

    const prepared = [];

    for (
      const requested
      of dto.items
    ) {
      const sku =
        requested.sku
          .trim()
          .toUpperCase();

      const {
        product,
        variant,
      } =
        await this.catalog
          .findVariantBySku(
            sku,
          );

      if (
        !product.active ||
        !variant.active
      ) {
        throw new BadRequestException(
          `${sku} is not currently available`,
        );
      }

      const stock =
        await this.inventory.get(
          sku,
        );

      if (
        stock.available <
        requested.quantity
      ) {
        throw new BadRequestException(
          `Only ${stock.available} unit(s) of ${sku} are available`,
        );
      }

      prepared.push({
        sku,
        quantity:
          requested.quantity,

        productId:
          new Types.ObjectId(
            String(product._id),
          ),

        productCode:
          product.productCode ?? '',

        productSlug:
          product.slug,

        productName:
          product.name,

        variantTitle:
          variant.title,

        unitPrice:
          variant.price,

        lineTotal:
          variant.price *
          requested.quantity,
      });
    }

    const subtotal =
      prepared.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.lineTotal,
        0,
      );

    /*
     * The delivery zone comes from the district on the address, never
     * from the zone the browser sent.
     */
    const deliveryZone =
      deliveryZoneFor(
        dto.shippingAddress.city,
      );

    const shippingFee =
      this.shippingFee(
        deliveryZone,
      );

    /*
     * 'cod' unless the customer chose to pay online. The gateway only
     * takes amounts within a range, so an order outside it is refused
     * here, before any stock is touched or a number is used.
     */
    const paymentMethod =
      dto.paymentMethod ?? 'cod';

    if (
      paymentMethod !== 'cod' &&
      !isWithinOnlinePaymentLimits(
        subtotal + shippingFee,
      )
    ) {
      throw new BadRequestException(
        `Online payment is available for orders between BDT ${ONLINE_PAYMENT_MINIMUM} and BDT ${ONLINE_PAYMENT_MAXIMUM}. Choose cash on delivery for this order.`,
      );
    }

    /*
     * Guest checkout resolves the customer from checkout
     * contact information.
     *
     * Authenticated checkout must never infer ownership from
     * a phone number. The signed-in customerId is authoritative.
     */
    const linkedCustomer =
      customerId
        ? await this.customers
            .getById(
              customerId,
            )
        : await this.customers
            .upsertFromCheckout(
              dto.customer,
            );

    /*
     * Sequential and guaranteed unique: one atomic increment on the
     * `order` counter. It is taken before stock is touched, so every
     * stock movement of this order can name the order it belongs to.
     * If the order then fails, the number is simply not used.
     */
    const orderNumber =
      await this.sequences.nextCode(
        'order',
      );

    const adjusted:
      Array<{
        sku: string;
        quantity: number;
      }> = [];

    try {
      for (
        const item
        of prepared
      ) {
        await this.inventory.adjust(
          item.sku,
          {
            delta:
              -item.quantity,

            reason:
              'order_placed',

            reference:
              orderNumber,
          },
        );

        adjusted.push({
          sku: item.sku,
          quantity:
            item.quantity,
        });
      }

      const order =
        await this.orderModel.create({
          orderNumber,

          idempotencyKey:
            normalizedIdempotencyKey ??
            null,

          customerId:
            linkedCustomer._id,

          /*
           * Contact details are an order snapshot.
           * Customers may edit these at checkout without
           * changing which account owns the order.
           */
          customer: {
            name:
              dto.customer
                .name
                .trim(),

            phone:
              this.customers
                .normalizePhone(
                  dto.customer
                    .phone,
                ),

            email:
              dto.customer
                .email
                ?.trim()
                .toLowerCase() ??
              '',
          },

          items: prepared,

          shippingAddress: {
            addressLine1:
              dto.shippingAddress
                .addressLine1,

            addressLine2:
              dto.shippingAddress
                .addressLine2 ??
              '',

            city:
              dto.shippingAddress
                .city,

            area:
              dto.shippingAddress
                .area ??
              '',

            postalCode:
              dto.shippingAddress
                .postalCode ??
              '',

            zone:
              deliveryZone,
          },

          subtotal,
          shippingFee,

          total:
            subtotal +
            shippingFee,

          currency: 'BDT',
          paymentMethod,
          paymentStatus:
            'pending',

          status: 'pending',

          statusHistory: [
            {
              status: 'pending',
              paymentStatus: 'pending',
              trackingNumber: '',
              changedBy:
                customerId
                  ? 'customer'
                  : 'guest',
              at: new Date(),
            },
          ],
        });

      return order.toObject();
    } catch (error) {
      for (
        const item
        of adjusted.reverse()
      ) {
        await this.inventory
          .adjust(
            item.sku,
            {
              delta:
                item.quantity,

              reason:
                'order_rollback',

              reference:
                orderNumber,
            },
          )
          .catch(
            () => undefined,
          );
      }

      if (
        normalizedIdempotencyKey &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        const existing =
          await this.orderModel
            .findOne({
              idempotencyKey:
                normalizedIdempotencyKey,
            })
            .lean();

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  async list(
    status?: string,
  ) {
    const filter =
      status
        ? {
            status,
          }
        : {};

    return this.orderModel
      .find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();
  }

  async listForCustomer(
    customerId: string,
  ) {
    return this.orderModel
      .find({
        customerId:
          new Types.ObjectId(
            customerId,
          ),
      })
      .sort({
        createdAt: -1,
      })
      .lean();
  }

  async get(
    orderNumber: string,
  ) {
    const order =
      await this.orderModel
        .findOne({
          orderNumber:
            orderNumber
              .trim()
              .toUpperCase(),
        })
        .lean();

    if (!order) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    return order;
  }

  async track(
    orderNumber: string,
    phone: string,
  ) {
    const normalizedPhone =
      this.customers
        .normalizePhone(phone);

    const order =
      await this.orderModel
        .findOne({
          orderNumber:
            orderNumber
              .trim()
              .toUpperCase(),

          'customer.phone':
            normalizedPhone,
        })
        .lean();

    if (!order) {
      throw new NotFoundException(
        'Order not found for this phone number',
      );
    }

    return {
      orderNumber:
        order.orderNumber,

      status:
        order.status,

      paymentStatus:
        order.paymentStatus,

      trackingNumber:
        order.trackingNumber,

      items:
        order.items,

      total:
        order.total,

      currency:
        order.currency,

      shippingAddress:
        order.shippingAddress,

      createdAt:
        (order as any)
          .createdAt,
    };
  }

  /**
   * The little a shopper's browser may know about an order without
   * signing in: whether it was paid. No names, addresses or amounts.
   */
  async paymentSummary(
    orderNumber: string,
  ) {
    const order =
      await this.orderModel
        .findOne({
          orderNumber:
            orderNumber
              .trim()
              .toUpperCase(),
        })
        .lean();

    if (!order) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    return {
      orderNumber:
        order.orderNumber,
      status: order.status,
      paymentMethod:
        order.paymentMethod,
      paymentStatus:
        order.paymentStatus,
    };
  }

  /**
   * Records that the gateway has confirmed payment in full for an online
   * order. Safe to call twice: the second call changes nothing.
   *
   * It deliberately does not look at the order's status. If the order was
   * cancelled before the money arrived, it becomes "cancelled and paid",
   * which the admin shows as a refund that is due.
   */
  async recordOnlinePayment(
    orderNumber: string,
    payment: {
      provider: string;
      bankTranId: string;
      channel: string;
      amount: number;
      paidAt: Date;
      riskLevel: string;
      riskTitle: string;
      sandbox: boolean;
    },
  ) {
    const current =
      await this.orderModel
        .findOne({ orderNumber })
        .lean();

    if (!current) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    if (
      current.paymentStatus === 'paid' ||
      current.paymentStatus === 'refunded'
    ) {
      return current;
    }

    const updated =
      await this.orderModel
        .findOneAndUpdate(
          {
            orderNumber,
            // Only the first of two simultaneous notifications writes.
            paymentStatus:
              current.paymentStatus,
          },
          {
            $set: {
              paymentStatus: 'paid',
              payment,
            },

            $push: {
              statusHistory: {
                status:
                  current.status,
                paymentStatus:
                  'paid',
                trackingNumber:
                  current.trackingNumber ??
                  '',
                changedBy:
                  payment.provider,
                at: new Date(),
              },
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

    return (
      updated ??
      (await this.orderModel
        .findOne({ orderNumber })
        .lean())
    );
  }

  /**
   * Cancels an online order whose payment failed or was abandoned, and
   * puts its stock back. Only an order that is still pending and unpaid
   * is touched; anything else is returned as it is.
   */
  async cancelUnpaidOnlineOrder(
    orderNumber: string,
    paymentStatus:
      | 'failed'
      | 'cancelled',
    changedBy: string,
  ) {
    const updated =
      await this.orderModel
        .findOneAndUpdate(
          {
            orderNumber,
            status: 'pending',
            paymentMethod: {
              $ne: 'cod',
            },
            paymentStatus:
              'pending',
          },
          {
            $set: {
              status: 'cancelled',
              paymentStatus,
            },

            $push: {
              statusHistory: {
                status:
                  'cancelled',
                paymentStatus,
                trackingNumber: '',
                changedBy,
                at: new Date(),
              },
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

    if (updated) {
      await this.restoreCancelledStock(
        updated,
      );

      return updated;
    }

    const latest =
      await this.orderModel
        .findOne({ orderNumber })
        .lean();

    if (!latest) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    return latest;
  }

  /**
   * An admin confirms that a cancelled order which was paid online has
   * been refunded at the gateway. The refund itself is made in the
   * SSLCOMMERZ merchant panel.
   */
  async markRefunded(
    orderNumber: string,
    changedBy = 'admin',
  ) {
    const normalizedOrderNumber =
      orderNumber
        .trim()
        .toUpperCase();

    const actor =
      changedBy.trim() || 'admin';

    const current =
      await this.orderModel
        .findOne({
          orderNumber:
            normalizedOrderNumber,
        })
        .lean();

    if (!current) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    if (
      current.paymentStatus ===
      'refunded'
    ) {
      return current;
    }

    if (
      current.paymentMethod === 'cod' ||
      current.paymentStatus !== 'paid'
    ) {
      throw new BadRequestException(
        'Only an order that was paid online can be marked as refunded.',
      );
    }

    if (
      current.status !== 'cancelled'
    ) {
      throw new BadRequestException(
        'Cancel the order before marking it as refunded.',
      );
    }

    const updated =
      await this.orderModel
        .findOneAndUpdate(
          {
            orderNumber:
              normalizedOrderNumber,
            paymentStatus: 'paid',
          },
          {
            $set: {
              paymentStatus:
                'refunded',
            },

            $push: {
              statusHistory: {
                status:
                  current.status,
                paymentStatus:
                  'refunded',
                trackingNumber:
                  current.trackingNumber ??
                  '',
                changedBy: actor,
                at: new Date(),
              },
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

    return (
      updated ??
      (await this.orderModel
        .findOne({
          orderNumber:
            normalizedOrderNumber,
        })
        .lean())
    );
  }

  private async restoreCancelledStock(
    order: any,
  ) {
    for (
      const item
      of order.items
    ) {
      await this.inventory.adjust(
        item.sku,
        {
          delta:
            item.quantity,

          reason:
            'order_cancelled',

          reference:
            order.orderNumber,

          idempotencyKey:
            `order-cancel:${order.orderNumber}:${item.sku}`,
        },
      );
    }
  }

  async updateStatus(
    orderNumber: string,
    dto: UpdateOrderStatusDto,
    changedBy = 'admin',
    /*
     * Given when the change comes through the Developer API, so the
     * history shows which application made it and in which request.
     */
    origin?: {
      actorType: string;
      actorId: string;
      requestId: string;
    },
  ) {
    const normalizedOrderNumber =
      orderNumber
        .trim()
        .toUpperCase();

    /* The history requires a name; an empty one falls back to 'admin'. */
    const actor =
      changedBy.trim() || 'admin';

    const originFields = origin
      ? {
          actorType: origin.actorType,
          actorId: origin.actorId,
          requestId: origin.requestId,
        }
      : {};

    const current =
      await this.orderModel
        .findOne({
          orderNumber:
            normalizedOrderNumber,
        })
        .lean();

    if (!current) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    const transitions:
      Record<
        string,
        string[]
      > = {
        pending: [
          'confirmed',
          'cancelled',
        ],

        confirmed: [
          'processing',
          'cancelled',
        ],

        processing: [
          'shipped',
          'cancelled',
        ],

        shipped: [
          'delivered',
        ],

        delivered: [],
        cancelled: [],
      };

    /*
     * Repeating the current status is treated as an
     * idempotent retry.
     *
     * This is especially important for cancellation:
     * if a previous request changed the order status
     * but failed halfway through restocking, retrying
     * cancelled will safely resume the restock.
     */
    if (
      dto.status ===
      current.status
    ) {
      const sameStatusUpdate:
        Record<
          string,
          unknown
        > = {};

      if (
        dto.trackingNumber !==
        undefined
      ) {
        sameStatusUpdate.trackingNumber =
          dto.trackingNumber;
      }

      if (
        current.status ===
          'delivered' &&
        current.paymentMethod ===
          'cod'
      ) {
        sameStatusUpdate.paymentStatus =
          'paid';
      }

      if (
        current.status ===
          'cancelled' &&
        current.paymentStatus ===
          'pending'
      ) {
        sameStatusUpdate.paymentStatus =
          'cancelled';
      }

      let result:
        any = current;

      if (
        Object.keys(
          sameStatusUpdate,
        ).length > 0
      ) {
        const nextTrackingNumber =
          (sameStatusUpdate.trackingNumber as
            | string
            | undefined) ??
          current.trackingNumber ??
          '';

        const nextPaymentStatus =
          (sameStatusUpdate.paymentStatus as
            | string
            | undefined) ??
          current.paymentStatus;

        /*
         * A retry that changes nothing must not add a line to the
         * history; only a real change of tracking number or payment
         * status is recorded.
         */
        const somethingChanged =
          nextTrackingNumber !==
            (current.trackingNumber ?? '') ||
          nextPaymentStatus !==
            current.paymentStatus;

        result =
          await this.orderModel
            .findOneAndUpdate(
              {
                orderNumber:
                  normalizedOrderNumber,
              },
              {
                $set:
                  sameStatusUpdate,

                ...(somethingChanged
                  ? {
                      $push: {
                        statusHistory: {
                          status:
                            current.status,
                          paymentStatus:
                            nextPaymentStatus,
                          trackingNumber:
                            nextTrackingNumber,
                          changedBy: actor,
                          ...originFields,
                          at: new Date(),
                        },
                      },
                    }
                  : {}),
              },
              {
                new: true,
                runValidators:
                  true,
              },
            )
            .lean();
      }

      if (
        current.status ===
        'cancelled'
      ) {
        await this.restoreCancelledStock(
          current,
        );
      }

      return result;
    }

    const allowed =
      transitions[
        current.status
      ] ?? [];

    if (
      !allowed.includes(
        dto.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot move order from ${current.status} to ${dto.status}`,
      );
    }

    if (
      current.paymentMethod !== 'cod' &&
      current.paymentStatus !== 'paid' &&
      dto.status !== 'cancelled'
    ) {
      throw new BadRequestException(
        'This order is to be paid online and the payment has not been received. It can be confirmed once it is paid, or cancelled.',
      );
    }

    const update:
      Record<
        string,
        unknown
      > = {
        status:
          dto.status,
      };

    if (
      dto.trackingNumber !==
      undefined
    ) {
      update.trackingNumber =
        dto.trackingNumber;
    }

    /*
     * COD becomes paid only when the order is
     * actually delivered.
     */
    if (
      dto.status ===
        'delivered' &&
      current.paymentMethod ===
        'cod'
    ) {
      update.paymentStatus =
        'paid';
    }

    /*
     * Cancelling an unpaid order closes its payment too. An order that
     * was already paid online stays "paid": the money has to go back to
     * the customer, and the admin shows it as a refund that is due.
     */
    if (
      dto.status ===
        'cancelled' &&
      current.paymentStatus ===
        'pending'
    ) {
      update.paymentStatus =
        'cancelled';
    }

    /*
     * Optimistic status predicate prevents two
     * concurrent transitions from both succeeding.
     */
    const updated =
      await this.orderModel
        .findOneAndUpdate(
          {
            orderNumber:
              normalizedOrderNumber,

            status:
              current.status,
          },
          {
            $set:
              update,

            $push: {
              statusHistory: {
                status:
                  dto.status,

                paymentStatus:
                  (update.paymentStatus as
                    | string
                    | undefined) ??
                  current.paymentStatus,

                trackingNumber:
                  (update.trackingNumber as
                    | string
                    | undefined) ??
                  current.trackingNumber ??
                  '',

                changedBy: actor,
                ...originFields,
                at: new Date(),
              },
            },
          },
          {
            new: true,
            runValidators:
              true,
          },
        )
        .lean();

    if (!updated) {
      const latest =
        await this.orderModel
          .findOne({
            orderNumber:
              normalizedOrderNumber,
          })
          .lean();

      if (!latest) {
        throw new NotFoundException(
          'Order not found',
        );
      }

      /*
       * Another request may already have completed
       * the exact same transition. Treat that as
       * an idempotent retry.
       */
      if (
        latest.status ===
        dto.status
      ) {
        if (
          latest.status ===
          'cancelled'
        ) {
          await this.restoreCancelledStock(
            latest,
          );
        }

        return latest;
      }

      throw new BadRequestException(
        'Order status changed concurrently. Refresh and try again.',
      );
    }

    if (
      dto.status ===
      'cancelled'
    ) {
      await this.restoreCancelledStock(
        updated,
      );
    }

    return updated;
  }

}
