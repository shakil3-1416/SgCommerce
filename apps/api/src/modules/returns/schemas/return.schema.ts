import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
} from 'mongoose';

export type ReturnRequestDocument =
  HydratedDocument<ReturnRequest>;

@Schema({
  _id: false,
})
export class ReturnItem {
  @Prop({
    type: String,
    required: true,
  })
  sku!: string;

  @Prop({
    type: String,
    required: true,
  })
  productName!: string;

  @Prop({
    type: String,
    required: true,
  })
  variantTitle!: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  quantity!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  unitPrice!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  refundAmount!: number;
}

const ReturnItemSchema =
  SchemaFactory.createForClass(
    ReturnItem,
  );

@Schema({
  timestamps: true,
  collection: 'returns',
})
export class ReturnRequest {
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
    index: true,
  })
  customerPhone!: string;

  @Prop({
    type: [ReturnItemSchema],
    required: true,
  })
  items!: ReturnItem[];

  @Prop({
    type: String,
    required: true,
  })
  reason!: string;

  @Prop({
    type: String,
    default: '',
  })
  details!: string;

  @Prop({
    type: String,
    default: 'requested',
    enum: [
      'requested',
      'approved',
      'rejected',
      'received',
      'completed',
    ],
    index: true,
  })
  status!: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  refundAmount!: number;

  @Prop({
    type: Boolean,
    default: false,
  })
  restocked!: boolean;
}

export const ReturnRequestSchema =
  SchemaFactory.createForClass(
    ReturnRequest,
  );


ReturnRequestSchema.index({
  orderNumber: 1,
  status: 1,
});
