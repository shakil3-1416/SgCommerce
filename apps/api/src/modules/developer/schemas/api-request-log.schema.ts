import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiRequestLogDocument = HydratedDocument<ApiRequestLog>;

/*
 * One line per request an application makes to the Developer API. It is
 * what lets "request req_01ab… failed" be looked up.
 *
 * The collection is capped: it holds the most recent requests in a fixed
 * amount of space and drops the oldest by itself, so a busy integration
 * can never fill the database. No query strings, bodies or credentials
 * are recorded.
 */
@Schema({
  collection: 'api_request_logs',
  timestamps: { createdAt: true, updatedAt: false },
  capped: { size: 50 * 1024 * 1024, max: 200_000 },
})
export class ApiRequestLog {
  @Prop({ type: String, required: true, index: true })
  requestId!: string;

  @Prop({ type: String, required: true, index: true })
  appId!: string;

  /** The application's name at the time, so the line still reads well after a rename. */
  @Prop({ type: String, default: '' })
  appName!: string;

  @Prop({ type: String, required: true })
  method!: string;

  /** The path only, without the query string. */
  @Prop({ type: String, required: true })
  path!: string;

  @Prop({ type: Number, required: true })
  status!: number;

  /** The error code returned, or '' for a success. */
  @Prop({ type: String, default: '' })
  code!: string;

  @Prop({ type: Number, default: 0 })
  durationMs!: number;

  @Prop({ type: String, default: '' })
  ip!: string;

  @Prop({ type: String, default: '' })
  userAgent!: string;
}

export const ApiRequestLogSchema = SchemaFactory.createForClass(ApiRequestLog);

export type ApiUsageDocument = HydratedDocument<ApiUsage>;

/*
 * How many requests an application made on one day (Bangladesh time).
 * Kept apart from the log so the numbers stay right after old log lines
 * have been dropped.
 */
@Schema({ collection: 'api_usage_daily' })
export class ApiUsage {
  @Prop({ type: String, required: true })
  appId!: string;

  /** "2026-10-07" */
  @Prop({ type: String, required: true })
  day!: string;

  @Prop({ type: Number, default: 0 })
  requests!: number;

  /** Requests answered with a 4xx or 5xx status. */
  @Prop({ type: Number, default: 0 })
  errors!: number;
}

export const ApiUsageSchema = SchemaFactory.createForClass(ApiUsage);

ApiUsageSchema.index({ appId: 1, day: 1 }, { unique: true });
