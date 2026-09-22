import {
  BadRequestException,
  ConflictException,
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
  RedisService,
} from '../../infrastructure/redis/redis.service';

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

    private readonly redis:
      RedisService,
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
        .replace(
          /\s+/g,
          '',
        );

    const lockKey =
      `return-create:${orderNumber}`;

    const lockToken =
      await this.redis
        .acquireLock(
          lockKey,
          15000,
        );

    if (!lockToken) {
      throw new ConflictException(
        'Another return request for this order is being processed',
      );
    }

    try {
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

      const previousReturns =
        await this.returnModel
          .find({
            orderNumber,

            status: {
              $ne:
                'rejected',
            },
          })
          .lean();

      const alreadyRequested =
        new Map<
          string,
          number
        >();

      for (
        const previous
        of previousReturns
      ) {
        for (
          const item
          of previous.items
        ) {
          const sku =
            item.sku
              .trim()
              .toUpperCase();

          alreadyRequested.set(
            sku,
            (
              alreadyRequested.get(
                sku,
              ) ??
              0
            ) +
              item.quantity,
          );
        }
      }

      const seen =
        new Set<
          string
        >();

      const prepared = [];

      for (
        const requested
        of dto.items
      ) {
        const sku =
          requested.sku
            .trim()
            .toUpperCase();

        if (
          seen.has(
            sku,
          )
        ) {
          throw new BadRequestException(
            'Duplicate return SKU',
          );
        }

        seen.add(
          sku,
        );

        const orderItem =
          order.items.find(
            (
              item,
            ) =>
              item.sku ===
              sku,
          );

        if (!orderItem) {
          throw new BadRequestException(
            `${sku} is not part of this order`,
          );
        }

        const previouslyRequested =
          alreadyRequested.get(
            sku,
          ) ??
          0;

        const remaining =
          orderItem.quantity -
          previouslyRequested;

        if (
          requested.quantity >
          remaining
        ) {
          throw new BadRequestException(
            `Only ${Math.max(
              0,
              remaining,
            )} unit(s) of ${sku} remain eligible for return`,
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

      return this.returnModel
        .create({
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
            dto.details ??
            '',

          refundAmount,

          status:
            'requested',

          restocked:
            false,
        });
    } finally {
      await this.redis
        .releaseLock(
          lockKey,
          lockToken,
        )
        .catch(
          () =>
            undefined,
        );
    }
  }

  async listForCustomer(
    customerId: string,
  ) {
    const orders =
      await this.orderModel
        .find({
          customerId,
        })
        .select({
          orderNumber: 1,
        })
        .lean();

    const orderNumbers =
      orders.map(
        (
          order,
        ) =>
          order.orderNumber,
      );

    if (
      orderNumbers.length ===
      0
    ) {
      return [];
    }

    return this.returnModel
      .find({
        orderNumber: {
          $in:
            orderNumbers,
        },
      })
      .sort({
        createdAt: -1,
      })
      .lean();
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
    const normalizedReturnNumber =
      returnNumber
        .trim()
        .toUpperCase();

    const lockKey =
      `return-status:${normalizedReturnNumber}`;

    const lockToken =
      await this.redis
        .acquireLock(
          lockKey,
          15000,
        );

    if (!lockToken) {
      throw new ConflictException(
        'This return is already being updated',
      );
    }

    try {
      const request =
        await this.returnModel
          .findOne({
            returnNumber:
              normalizedReturnNumber,
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

      const restock =
        async () => {
          if (
            request.restocked
          ) {
            return;
          }

          for (
            const item
            of request.items
          ) {
            await this.inventory
              .adjust(
                item.sku,
                {
                  delta:
                    item.quantity,

                  reason:
                    'return_received',

                  reference:
                    request.returnNumber,

                  idempotencyKey:
                    `return-restock:${request.returnNumber}:${item.sku}`,
                },
              );
          }

          request.restocked =
            true;
        };

      if (
        dto.status ===
        request.status
      ) {
        if (
          request.status ===
            'received' &&
          !request.restocked
        ) {
          await restock();
          await request.save();
        }

        if (
          request.status ===
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
        'received'
      ) {
        await restock();
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
    } finally {
      await this.redis
        .releaseLock(
          lockKey,
          lockToken,
        )
        .catch(
          () =>
            undefined,
        );
    }
  }

}
