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

import {
  SequencesService,
} from '../sequences/sequences.service';

@Injectable()
export class RefundsService {
  constructor(
    @InjectModel(Refund.name)
    private readonly refundModel:
      Model<RefundDocument>,

    private readonly sequences:
      SequencesService,
  ) {}

  async ensureForReturn(input: {
    returnNumber: string;
    orderNumber: string;
    customerPhone: string;
    amount: number;
  }) {
    /*
     * One refund per return. Looking first means a repeated call does
     * not take a new number from the `refund` counter each time.
     */
    const existing =
      await this.refundModel
        .findOne({
          returnNumber:
            input.returnNumber,
        });

    if (existing) {
      return existing;
    }

    const refundNumber =
      await this.sequences.nextCode(
        'refund',
      );

    return this.refundModel
      .findOneAndUpdate(
        {
          returnNumber:
            input.returnNumber,
        },
        {
          $setOnInsert: {
            refundNumber,

            returnNumber:
              input.returnNumber,

            orderNumber:
              input.orderNumber,

            customerPhone:
              input.customerPhone,

            amount:
              input.amount,

            currency:
              'BDT',

            method:
              'manual',

            status:
              'pending',
          },
        },
        {
          upsert:
            true,

          new:
            true,

          runValidators:
            true,
        },
      );
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
