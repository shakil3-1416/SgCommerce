import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

/*
 * One line each time something is heard about a payment: when the session
 * was created, when the customer came back, when SSLCOMMERZ notified the
 * server, when an admin asked for a check. Lines are only ever added.
 */
@Schema({ _id: false })
export class PaymentEvent {
  @Prop({ type: Date, required: true })
  at!: Date;

  /** 'start', 'success', 'fail', 'cancel', 'ipn' or 'check'. */
  @Prop({ type: String, required: true })
  source!: string;

  @Prop({ type: String, default: '' })
  note!: string;
}

const PaymentEventSchema = SchemaFactory.createForClass(PaymentEvent);

/**
 * An online payment for one order. The order keeps the summary a shop
 * needs day to day; this record keeps the detail for reconciling with
 * the gateway.
 */
@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: String, required: true, index: true })
  orderNumber!: string;

  @Prop({ type: String, required: true, default: 'sslcommerz' })
  provider!: string;

  /** Sent to the gateway as tran_id. It is the order number. */
  @Prop({ type: String, required: true, unique: true })
  tranId!: string;

  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({ type: String, required: true, default: 'BDT' })
  currency!: string;

  /**
   * started    the customer was sent to the gateway
   * paid       SSLCOMMERZ confirmed payment in full
   * failed     the bank declined, or the gateway could not be started
   * cancelled  the customer cancelled, or the session expired
   * review     money may have moved but did not match the order; a person
   *            has to look at it in the SSLCOMMERZ panel
   */
  @Prop({
    type: String,
    required: true,
    enum: ['started', 'paid', 'failed', 'cancelled', 'review'],
    default: 'started',
  })
  status!: string;

  @Prop({ type: Boolean, default: false })
  sandbox!: boolean;

  @Prop({ type: String, default: '' })
  sessionKey!: string;

  @Prop({ type: String, default: '' })
  gatewayUrl!: string;

  @Prop({ type: String, default: '' })
  valId!: string;

  @Prop({ type: String, default: '' })
  bankTranId!: string;

  /** The channel the customer used, for example "BKASH-BKash" or "VISA-Dutch Bangla". */
  @Prop({ type: String, default: '' })
  cardType!: string;

  @Prop({ type: String, default: '' })
  cardBrand!: string;

  @Prop({ type: String, default: '' })
  cardIssuer!: string;

  /** Already masked by the gateway, for example 425272XXXXXX3456. */
  @Prop({ type: String, default: '' })
  cardNo!: string;

  /** What reaches the merchant after the gateway's charge. */
  @Prop({ type: Number, default: null })
  storeAmount!: number | null;

  @Prop({ type: String, default: '' })
  riskLevel!: string;

  @Prop({ type: String, default: '' })
  riskTitle!: string;

  @Prop({ type: String, default: '' })
  problem!: string;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ type: [PaymentEventSchema], default: [] })
  events!: PaymentEvent[];
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
