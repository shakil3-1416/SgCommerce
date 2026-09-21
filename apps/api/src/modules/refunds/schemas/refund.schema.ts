import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
} from 'mongoose';

export type RefundDocument =
  HydratedDocument<Refund>;

@Schema({
  timestamps: true,
  collection: 'refunds',
})
export class Refund {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  refundNumber!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  returnNumber!: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  orderNumber!: string;

  @Prop({
    type: String,
    required: true,
  })
  customerPhone!: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  amount!: number;

  @Prop({
    type: String,
    default: 'BDT',
  })
  currency!: string;

  @Prop({
    type: String,
    default: 'manual',
  })
  method!: string;

  @Prop({
    type: String,
    default: 'pending',
    enum: [
      'pending',
      'completed',
      'failed',
    ],
    index: true,
  })
  status!: string;

  @Prop({
    type: String,
    default: '',
  })
  note!: string;
}

export const RefundSchema =
  SchemaFactory.createForClass(
    Refund,
  );
