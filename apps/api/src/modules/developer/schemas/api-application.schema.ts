import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiApplicationDocument = HydratedDocument<ApiApplication>;

/**
 * An outside program that may use the Developer API: an ERP, a courier
 * integration, a CRM. Each application has its own credential and its own
 * scopes, so one can be switched off without breaking the others.
 *
 * The credential itself is never stored: only its SHA-256 hash, which is
 * enough to recognise the credential when it is presented and useless to
 * anyone who reads the database.
 */
@Schema({ timestamps: true, collection: 'api_applications' })
export class ApiApplication {
  /** Public identifier, for example "app_3f9a1c2b4d5e6f70". */
  @Prop({ type: String, required: true, unique: true })
  appId!: string;

  /** What the application is, chosen by the merchant: "Warehouse ERP". */
  @Prop({ type: String, required: true, trim: true })
  name!: string;

  /** 'live' or 'test': where the credential was issued and the only place it works. */
  @Prop({ type: String, required: true, enum: ['live', 'test'] })
  environment!: string;

  @Prop({ type: String, required: true, unique: true })
  keyHash!: string;

  /** "sg_live_3f9a…c41d": enough to recognise the credential in a list. */
  @Prop({ type: String, required: true })
  keyHint!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: String, required: true, enum: ['active', 'revoked'], default: 'active', index: true })
  status!: string;

  /** The admin who registered the application. */
  @Prop({ type: String, default: '' })
  createdBy!: string;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: '' })
  revokedBy!: string;
}

export const ApiApplicationSchema = SchemaFactory.createForClass(ApiApplication);
