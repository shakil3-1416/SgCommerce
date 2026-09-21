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
} from 'mongoose';

import {
  InventoryService,
} from '../inventory/inventory.service';

import {
  Order,
  OrderDocument,
} from '../orders/schemas/order.schema';

import {
  RefundsService,
} from '../refunds/refunds.service';

import {
  CreateReturnDto,
  UpdateReturnStatusDto,
} from './dto/return.dto';

import {
  ReturnRequest,
  ReturnRequestDocument,
} from './schemas/return.schema';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectModel(ReturnRequest.name)
    private readonly returnModel:
      Model<ReturnRequestDocument>,

    @InjectModel(Order.name)
    private readonly orderModel:
      Model<OrderDocument>,

    private readonly inventory:
      InventoryService,

    private readonly refunds:
      RefundsService,
  ) {}

  private generateNumber() {
    const random =
      Math.random()
        .toString(36)
        .slice(2, 9)
        .toUpperCase();

    return `RT-${Date.now()}-${random}`;
  }

  async create(
    dto: CreateReturnDto,
  ) {
    const orderNumber =
      dto.orderNumber
        .trim()
        .toUpperCase();

    const phone =
      dto.phone
        .trim()
        .replace(/\s+/g, '');

    const order =
      await this.orderModel
        .findOne({
          orderNumber,
          'customer.phone':
            phone,
        })
        .lean();

    if (!order) {
      throw new NotFoundException(
        'Order not found for this phone number',
      );
    }

    if (
      order.status !==
      'delivered'
    ) {
      throw new BadRequestException(
        'Returns can only be requested after delivery',
      );
    }

    const seen =
      new Set<string>();

    const prepared = [];

    for (
      const requested
      of dto.items
    ) {
      const sku =
        requested.sku
          .trim()
          .toUpperCase();

      if (seen.has(sku)) {
        throw new BadRequestException(
          'Duplicate return SKU',
        );
      }

      seen.add(sku);

      const orderItem =
        order.items.find(
          (item) =>
            item.sku === sku,
        );

      if (!orderItem) {
        throw new BadRequestException(
          `${sku} is not part of this order`,
        );
      }

      if (
        requested.quantity >
        orderItem.quantity
      ) {
        throw new BadRequestException(
          `Return quantity for ${sku} exceeds ordered quantity`,
        );
      }

      prepared.push({
        sku,

        productName:
          orderItem.productName,

        variantTitle:
          orderItem.variantTitle,

        quantity:
          requested.quantity,

        unitPrice:
          orderItem.unitPrice,

        refundAmount:
          orderItem.unitPrice *
          requested.quantity,
      });
    }

    const refundAmount =
      prepared.reduce(
        (
          sum,
          item,
        ) =>
          sum +
          item.refundAmount,
        0,
      );

    return this.returnModel.create({
      returnNumber:
        this.generateNumber(),

      orderNumber,
      customerPhone:
        phone,

      items:
        prepared,

      reason:
        dto.reason,

      details:
        dto.details ?? '',

      refundAmount,
      status: 'requested',
      restocked: false,
    });
  }

  async list(
    status?: string,
  ) {
    return this.returnModel
      .find(
        status
          ? { status }
          : {},
      )
      .sort({
        createdAt: -1,
      })
      .lean();
  }

  async get(
    returnNumber: string,
  ) {
    const request =
      await this.returnModel
        .findOne({
          returnNumber:
            returnNumber
              .trim()
              .toUpperCase(),
        })
        .lean();

    if (!request) {
      throw new NotFoundException(
        'Return request not found',
      );
    }

    return request;
  }

  async updateStatus(
    returnNumber: string,
    dto: UpdateReturnStatusDto,
  ) {
    const request =
      await this.returnModel
        .findOne({
          returnNumber:
            returnNumber
              .trim()
              .toUpperCase(),
        });

    if (!request) {
      throw new NotFoundException(
        'Return request not found',
      );
    }

    const transitions:
      Record<
        string,
        string[]
      > = {
        requested: [
          'approved',
          'rejected',
        ],

        approved: [
          'received',
        ],

        received: [
          'completed',
        ],

        rejected: [],
        completed: [],
      };

    if (
      dto.status ===
      request.status
    ) {
      return request.toObject();
    }

    if (
      !(
        transitions[
          request.status
        ] ?? []
      ).includes(
        dto.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot move return from ${request.status} to ${dto.status}`,
      );
    }

    if (
      dto.status ===
        'received' &&
      !request.restocked
    ) {
      for (
        const item
        of request.items
      ) {
        await this.inventory.adjust(
          item.sku,
          {
            delta:
              item.quantity,

            reason:
              'return_received',

            reference:
              request.returnNumber,
          },
        );
      }

      request.restocked =
        true;
    }

    request.status =
      dto.status;

    await request.save();

    if (
      dto.status ===
      'completed'
    ) {
      await this.refunds
        .ensureForReturn({
          returnNumber:
            request.returnNumber,

          orderNumber:
            request.orderNumber,

          customerPhone:
            request.customerPhone,

          amount:
            request.refundAmount,
        });
    }

    return request.toObject();
  }
}
