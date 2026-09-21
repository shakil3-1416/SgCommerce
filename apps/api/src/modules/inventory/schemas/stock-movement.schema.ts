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
}

export const StockMovementSchema =
  SchemaFactory.createForClass(
    StockMovement,
  );

StockMovementSchema.index({
  sku: 1,
  createdAt: -1,
});
