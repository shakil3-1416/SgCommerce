import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  _id: false,
})
export class ProductVariant {
  @Prop({
    required: true,
    trim: true,
    uppercase: true,
  })
  sku!: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 160,
  })
  title!: string;

  @Prop({
    type: Object,
    default: {},
  })
  attributes!: Record<string, string>;

  @Prop({
    required: true,
    min: 0,
  })
  price!: number;

  @Prop({
    min: 0,
  })
  compareAtPrice?: number;

  @Prop({
    default: true,
  })
  active!: boolean;
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

@Schema({
  timestamps: true,
  collection: 'products',
})
export class Product {
  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
    index: true,
  })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  slug!: string;

  @Prop({
    trim: true,
    maxlength: 10000,
    default: '',
  })
  description!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  category!: Types.ObjectId;

  @Prop({
    trim: true,
    maxlength: 120,
    default: '',
  })
  brand!: string;

  @Prop({
    type: [String],
    default: [],
  })
  images!: string[];

  @Prop({
    type: [ProductVariantSchema],
    required: true,
    default: [],
  })
  variants!: ProductVariant[];

  @Prop({
    default: true,
    index: true,
  })
  active!: boolean;
}

export const ProductSchema =
  SchemaFactory.createForClass(Product);

ProductSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
});

ProductSchema.index(
  {
    'variants.sku': 1,
  },
  {
    unique: true,
    sparse: true,
  },
);
