import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type ProductDocument =
  HydratedDocument<Product>;

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
  attributes!: Record<
    string,
    string
  >;

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
  SchemaFactory.createForClass(
    ProductVariant,
  );

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

  @Prop({
    trim: true,
    index: true,
  })
  catalogSource?: string;

  @Prop({
    trim: true,
  })
  externalId?: string;
}

export const ProductSchema =
  SchemaFactory.createForClass(
    Product,
  );

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

ProductSchema.index({
  active: 1,
  category: 1,
  brand: 1,
});

ProductSchema.index({
  active: 1,
  'variants.price': 1,
});

ProductSchema.index(
  {
    catalogSource: 1,
    externalId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      catalogSource: {
        $type: 'string',
      },
      externalId: {
        $type: 'string',
      },
    },
  },
);
