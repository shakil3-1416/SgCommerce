import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type InventoryDocument =
  HydratedDocument<Inventory>;

@Schema({
  timestamps: true,
  collection: 'inventory',
})
export class Inventory {
  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  sku!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  @Prop({
    required: true,
  })
  productName!: string;

  @Prop({
    required: true,
  })
  variantTitle!: string;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  onHand!: number;

  @Prop({
    required: true,
    min: 0,
    default: 0,
  })
  reserved!: number;

  @Prop({
    required: true,
    min: 0,
    default: 5,
  })
  reorderLevel!: number;
  @Prop({
    type: [String],
    default: [],
    select: false,
  })
  appliedAdjustments!: string[];

}

export const InventorySchema =
  SchemaFactory.createForClass(
    Inventory,
  );

InventorySchema.index({
  productId: 1,
  sku: 1,
});
