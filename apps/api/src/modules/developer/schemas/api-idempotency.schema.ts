import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { IDEMPOTENCY_TTL_SECONDS } from '../developer-api';

export type ApiIdempotencyDocument = HydratedDocument<ApiIdempotency>;

/*
 * What happened the first time a write was made with a given
 * Idempotency-Key, so that a repeat gets the same answer. One per
 * application and key; forgotten after a day.
 */
@Schema({ collection: 'api_idempotency_keys', timestamps: { createdAt: true, updatedAt: false } })
export class ApiIdempotency {
  @Prop({ type: String, required: true })
  appId!: string;

  @Prop({ type: String, required: true })
  key!: string;

  /** Hash of the method, path and body the key was first used with. */
  @Prop({ type: String, required: true })
  fingerprint!: string;

  /** 'in_progress' while the first request is still being handled. */
  @Prop({ type: String, required: true, enum: ['in_progress', 'completed'], default: 'in_progress' })
  state!: string;

  @Prop({ type: Number, default: 0 })
  status!: number;

  /** The answer that was sent, to send again. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  body!: unknown;

  /*
   * When the request that holds the key started. If it never finishes,
   * a later request may take the key over, and does so by moving this
   * forward. (The creation time set by `timestamps` cannot be changed,
   * so it is used only to forget the key after a day.)
   */
  @Prop({ type: Date, required: true })
  startedAt!: Date;
}

export const ApiIdempotencySchema = SchemaFactory.createForClass(ApiIdempotency);

ApiIdempotencySchema.index({ appId: 1, key: 1 }, { unique: true });
ApiIdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_TTL_SECONDS });
