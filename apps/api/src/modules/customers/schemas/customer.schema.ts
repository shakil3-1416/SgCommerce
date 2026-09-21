import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
} from 'mongoose';

export type CustomerDocument =
  HydratedDocument<Customer>;

@Schema({
  _id: false,
})
export class CustomerAddress {
  @Prop({
    type: String,
    required: true,
  })
  id!: string;

  @Prop({
    type: String,
    required: true,
  })
  label!: string;

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

  @Prop({
    type: Boolean,
    default: false,
  })
  isDefault!: boolean;
}

export const CustomerAddressSchema =
  SchemaFactory.createForClass(
    CustomerAddress,
  );

@Schema({
  timestamps: true,
  collection: 'customers',
})
export class Customer {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true,
  })
  phone!: string;

  @Prop({
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  })
  email!: string;

  @Prop({
    type: [CustomerAddressSchema],
    default: [],
  })
  addresses!: CustomerAddress[];

  @Prop({
    type: Boolean,
    default: true,
  })
  active!: boolean;
}

export const CustomerSchema =
  SchemaFactory.createForClass(
    Customer,
  );
