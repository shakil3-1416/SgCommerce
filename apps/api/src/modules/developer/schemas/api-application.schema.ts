import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiApplicationDocument = HydratedDocument<ApiApplication>;

/*
 * One line each time something about an application changes: created,
 * renamed, permissions changed, key replaced, revoked. Who did it and
 * when. Lines are only ever added.
 */
@Schema({ _id: false })
export class ApiApplicationEvent {
  @Prop({ type: Date, required: true })
  at!: Date;

  /** The admin who made the change. */
  @Prop({ type: String, required: true })
  actor!: string;

  /** 'created', 'updated', 'scopes_changed', 'key_rolled' or 'revoked'. */
  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String, default: '' })
  detail!: string;
}

const ApiApplicationEventSchema = SchemaFactory.createForClass(ApiApplicationEvent);

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

  /** What it is for and who to contact about it. */
  @Prop({ type: String, default: '', trim: true })
  description!: string;

  /** 'live' or 'test': where the credential was issued and the only place it works. */
  @Prop({ type: String, required: true, enum: ['live', 'test'] })
  environment!: string;

  @Prop({ type: String, required: true, unique: true })
  keyHash!: string;

  /** "sg_live_3f9a…c41d": enough to recognise the credential in a list. */
  @Prop({ type: String, required: true })
  keyHint!: string;

  @Prop({ type: Date, default: null })
  keyCreatedAt!: Date | null;

  /** The current key stops working at this time. Null: it does not expire. */
  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  /*
   * After a key is replaced, the old one may keep working for a while so
   * the system using it can be switched over. These three describe it.
   */
  @Prop({ type: String, default: '', index: true })
  previousKeyHash!: string;

  @Prop({ type: String, default: '' })
  previousKeyHint!: string;

  @Prop({ type: Date, default: null })
  previousKeyExpiresAt!: Date | null;

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

  @Prop({ type: [ApiApplicationEventSchema], default: [] })
  events!: ApiApplicationEvent[];
}

export const ApiApplicationSchema = SchemaFactory.createForClass(ApiApplication);
