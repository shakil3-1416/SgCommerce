import {
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
  UpdateRefundDto,
} from './dto/refund.dto';

import {
  Refund,
  RefundDocument,
} from './schemas/refund.schema';

@Injectable()
export class RefundsService {
  constructor(
    @InjectModel(Refund.name)
    private readonly refundModel:
      Model<RefundDocument>,
  ) {}

  private generateNumber() {
    const random =
      Math.random()
        .toString(36)
        .slice(2, 9)
        .toUpperCase();

    return `RF-${Date.now()}-${random}`;
  }

  async ensureForReturn(input: {
    returnNumber: string;
    orderNumber: string;
    customerPhone: string;
    amount: number;
  }) {
    const existing =
      await this.refundModel.findOne({
        returnNumber:
          input.returnNumber,
      });

    if (existing) {
      return existing;
    }

    return this.refundModel.create({
      refundNumber:
        this.generateNumber(),

      returnNumber:
        input.returnNumber,

      orderNumber:
        input.orderNumber,

      customerPhone:
        input.customerPhone,

      amount:
        input.amount,

      currency: 'BDT',
      method: 'manual',
      status: 'pending',
    });
  }

  async list(
    status?: string,
  ) {
    const filter =
      status
        ? { status }
        : {};

    return this.refundModel
      .find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();
  }

  async get(
    refundNumber: string,
  ) {
    const refund =
      await this.refundModel
        .findOne({
          refundNumber:
            refundNumber
              .trim()
              .toUpperCase(),
        })
        .lean();

    if (!refund) {
      throw new NotFoundException(
        'Refund not found',
      );
    }

    return refund;
  }

  async update(
    refundNumber: string,
    dto: UpdateRefundDto,
  ) {
    const refund =
      await this.refundModel
        .findOneAndUpdate(
          {
            refundNumber:
              refundNumber
                .trim()
                .toUpperCase(),
          },
          {
            $set: {
              status:
                dto.status,

              ...(dto.note !==
              undefined
                ? {
                    note:
                      dto.note,
                  }
                : {}),
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .lean();

    if (!refund) {
      throw new NotFoundException(
        'Refund not found',
      );
    }

    return refund;
  }
}
