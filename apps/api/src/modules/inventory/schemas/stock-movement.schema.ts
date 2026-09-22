import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
} from 'mongoose';

export type StockMovementDocument =
  HydratedDocument<StockMovement>;

@Schema({
  timestamps: true,
  collection: 'stock_movements',
})
export class StockMovement {
  @Prop({
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  sku!: string;

  @Prop({
    required: true,
  })
  delta!: number;

  @Prop({
    required: true,
  })
  reason!: string;

  @Prop({
    default: '',
  })
  reference!: string;

  @Prop({
    required: true,
  })
  resultingOnHand!: number;
  @Prop({
    type: String,
    trim: true,
    maxlength: 240,
  })
  idempotencyKey?: string;

}

export const StockMovementSchema =
  SchemaFactory.createForClass(
    StockMovement,
  );

StockMovementSchema.index({
  sku: 1,
  createdAt: -1,
});


StockMovementSchema.index(
  {
    idempotencyKey: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);
