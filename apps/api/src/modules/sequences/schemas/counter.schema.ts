import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import type { HydratedDocument } from 'mongoose';

/**
 * One document per numbered record type, for example
 *   { _id: 'product', seq: 216 }
 *
 * `seq` is the last number issued. It is only ever changed with an atomic
 * `$inc`, which is what makes the numbers unique when several API instances
 * (or several serverless invocations) create records at the same moment.
 *
 * `seq` deliberately has no schema default: Mongoose would add it to the
 * upsert as `$setOnInsert`, next to the `$inc` on the same field.
 */
@Schema({
  collection: 'counters',
  versionKey: false,
})
export class Counter {
  @Prop({
    type: String,
    required: true,
  })
  _id!: string;

  @Prop({
    type: Number,
    required: true,
  })
  seq!: number;
}

export type CounterDocument = HydratedDocument<Counter>;

export const CounterSchema = SchemaFactory.createForClass(Counter);
