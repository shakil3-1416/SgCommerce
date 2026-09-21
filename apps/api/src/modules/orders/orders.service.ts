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
  ) {}

  private generateOrderNumber() {
    const date =
      new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');

    const random =
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    return `SG-${date}-${random}`;
  }

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

    const shippingFee =
      this.shippingFee(
        dto.shippingAddress
          .zone,
      );

    const customer =
      await this.customers
        .upsertFromCheckout(
          dto.customer,
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
              'checkout',
          },
        );

        adjusted.push({
          sku: item.sku,
          quantity:
            item.quantity,
        });
      }

      const orderNumber =
        this.generateOrderNumber();

      const order =
        await this.orderModel.create({
          orderNumber,

          idempotencyKey:
            normalizedIdempotencyKey ??
            null,

          customerId:
            customer._id,

          customer: {
            name:
              customer.name,

            phone:
              customer.phone,

            email:
              customer.email,
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
              dto.shippingAddress
                .zone,
          },

          subtotal,
          shippingFee,

          total:
            subtotal +
            shippingFee,

          currency: 'BDT',
          paymentMethod: 'cod',
          paymentStatus:
            'pending',

          status: 'pending',
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
                'checkout_failed',
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
      phone
        .trim()
        .replace(/\s+/g, '');

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

  async updateStatus(
    orderNumber: string,
    dto: UpdateOrderStatusDto,
  ) {
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

    const order =
      await this.orderModel
        .findOneAndUpdate(
          {
            orderNumber:
              orderNumber
                .trim()
                .toUpperCase(),
          },
          {
            $set: update,
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

    if (!order) {
      throw new NotFoundException(
        'Order not found',
      );
    }

    return order;
  }
}
