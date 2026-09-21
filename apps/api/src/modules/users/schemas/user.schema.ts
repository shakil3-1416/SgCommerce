import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  HydratedDocument,
  Types,
} from 'mongoose';

export type UserDocument =
  HydratedDocument<User>;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  })
  phone!: string;

  @Prop({
    type: String,
    required: true,
  })
  passwordHash!: string;

  @Prop({
    type: String,
    required: true,
  })
  passwordSalt!: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      'customer',
      'admin',
    ],
    index: true,
  })
  role!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Customer',
    default: null,
  })
  customerId!: Types.ObjectId | null;

  @Prop({
    type: Boolean,
    default: true,
  })
  active!: boolean;
}

export const UserSchema =
  SchemaFactory.createForClass(
    User,
  );
