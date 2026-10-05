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

  /*
   * The product's business code at the time of the order, for example
   * "SGP-000217". Empty on orders placed before product codes existed.
   */
  @Prop({
    type: String,
    default: '',
  })
  productCode!: string;

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

/*
 * One entry each time the order's status, payment status or tracking
 * number changes: what it became, who changed it and when. Entries are
 * only ever added, never edited.
 */
@Schema({
  _id: false,
})
export class OrderStatusChange {
  @Prop({
    type: String,
    required: true,
  })
  status!: string;

  @Prop({
    type: String,
    required: true,
  })
  paymentStatus!: string;

  @Prop({
    type: String,
    default: '',
  })
  trackingNumber!: string;

  /*
   * 'customer' or 'guest' for the entry written at checkout; the
   * admin's email for changes made in the admin.
   */
  @Prop({
    type: String,
    required: true,
  })
  changedBy!: string;

  @Prop({
    type: Date,
    required: true,
  })
  at!: Date;
}

const OrderStatusChangeSchema =
  SchemaFactory.createForClass(
    OrderStatusChange,
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
      'cancelled',
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

  @Prop({
    type: [OrderStatusChangeSchema],
    default: [],
  })
  statusHistory!: OrderStatusChange[];
}

export const OrderSchema =
  SchemaFactory.createForClass(Order);

OrderSchema.index({
  'customer.phone': 1,
  createdAt: -1,
});
