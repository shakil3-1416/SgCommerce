import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({
  timestamps: true,
  collection: 'categories',
})
export class Category {
  @Prop({
    required: true,
    trim: true,
    maxlength: 120,
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
    maxlength: 1000,
    default: '',
  })
  description!: string;

  @Prop({
    default: true,
    index: true,
  })
  active!: boolean;
}

export const CategorySchema =
  SchemaFactory.createForClass(Category);

CategorySchema.index({
  name: 'text',
  description: 'text',
});
