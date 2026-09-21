import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type OrderDocument =
  HydratedDocument<Order>;

@Schema({
  _id: false,
})
export class OrderCustomer {
  @Prop({
    type: String,
    required: true,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
  })
  phone!: string;

  @Prop({
    type: String,
    default: '',
  })
  email!: string;
}

const OrderCustomerSchema =
  SchemaFactory.createForClass(
    OrderCustomer,
  );

@Schema({
  _id: false,
})
export class ShippingAddress {
  @Prop({
    type: String,
    required: true,
  })
  addressLine1!: string;

  @Prop({
    type: String,
    default: '',
  })
  addressLine2!: string;

  @Prop({
    type: String,
    required: true,
  })
  city!: string;

  @Prop({
    type: String,
    default: '',
  })
  area!: string;

  @Prop({
    type: String,
    default: '',
  })
  postalCode!: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      'inside_dhaka',
      'outside_dhaka',
    ],
  })
  zone!: string;
}

const ShippingAddressSchema =
  SchemaFactory.createForClass(
    ShippingAddress,
  );

@Schema({
  _id: false,
})
export class OrderItem {
  @Prop({
    type: Types.ObjectId,
    required: true,
  })
  productId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  productSlug!: string;

  @Prop({
    type: String,
    required: true,
  })
  productName!: string;

  @Prop({
    type: String,
    required: true,
  })
  sku!: string;

  @Prop({
    type: String,
    required: true,
  })
  variantTitle!: string;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  unitPrice!: number;

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
  lineTotal!: number;
}

const OrderItemSchema =
  SchemaFactory.createForClass(
    OrderItem,
  );

@Schema({
  timestamps: true,
  collection: 'orders',
})
export class Order {
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
  })
  orderNumber!: string;

  @Prop({
    type: String,
    default: null,
    unique: true,
    sparse: true,
    index: true,
  })
  idempotencyKey!: string | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  })
  customerId!: Types.ObjectId;

  @Prop({
    type: OrderCustomerSchema,
    required: true,
  })
  customer!: OrderCustomer;

  @Prop({
    type: [OrderItemSchema],
    required: true,
  })
  items!: OrderItem[];

  @Prop({
    type: ShippingAddressSchema,
    required: true,
  })
  shippingAddress!: ShippingAddress;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  subtotal!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  shippingFee!: number;

  @Prop({
    type: Number,
    required: true,
    min: 0,
  })
  total!: number;

  @Prop({
    type: String,
    default: 'BDT',
  })
  currency!: string;

  @Prop({
    type: String,
    default: 'cod',
    enum: ['cod'],
  })
  paymentMethod!: string;

  @Prop({
    type: String,
    default: 'pending',
    enum: [
      'pending',
      'paid',
      'failed',
      'refunded',
    ],
  })
  paymentStatus!: string;

  @Prop({
    type: String,
    default: 'pending',
    index: true,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ],
  })
  status!: string;

  @Prop({
    type: String,
    default: '',
  })
  trackingNumber!: string;
}

export const OrderSchema =
  SchemaFactory.createForClass(Order);

OrderSchema.index({
  'customer.phone': 1,
  createdAt: -1,
});
