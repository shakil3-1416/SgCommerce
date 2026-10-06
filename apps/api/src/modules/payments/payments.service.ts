import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PlaceOrderDto } from '../orders/dto/order.dto';
import { OrdersService } from '../orders/orders.service';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  GatewayOutcome,
  ONLINE_PAYMENT_MAXIMUM,
  ONLINE_PAYMENT_MINIMUM,
  outcomeForStatus,
  SslcommerzConfig,
  ValidationResult,
  verifySign,
  whyNotPaid,
} from './sslcommerz';
import { GatewayError, SslcommerzClient } from './sslcommerz.client';

export type NotificationSource = 'success' | 'fail' | 'cancel' | 'ipn';

/* The fields of a stored payment that this service reads. */
type PaymentRecord = Pick<
  Payment,
  'orderNumber' | 'tranId' | 'amount' | 'bankTranId' | 'cardType' | 'riskLevel' | 'riskTitle' | 'sandbox'
> & { paidAt?: Date | null };

const NOT_AVAILABLE =
  'Online payment is not available right now. Choose cash on delivery, or try again later.';

/**
 * Online payment through SSLCOMMERZ.
 *
 * The rules this service keeps:
 *
 *   1. An order is marked paid only after SSLCOMMERZ's Order Validation
 *      API confirms the payment, for this order number, in BDT, for the
 *      exact total. What a browser says is never enough.
 *   2. A failed or cancelled payment cancels the order and returns its
 *      stock, but only when the message carries SSLCOMMERZ's signature.
 *   3. Every step can arrive twice (the customer's return and the server
 *      notification overlap), so every step is safe to repeat.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly payments: Model<PaymentDocument>,
    private readonly gateway: SslcommerzClient,
    private readonly orders: OrdersService,
  ) {}

  /** What the checkout page may offer. */
  methods() {
    const { config } = this.gateway.config();

    return {
      cod: true,
      online: config !== null,
      sandbox: config !== null && !config.live,
      minimum: ONLINE_PAYMENT_MINIMUM,
      maximum: ONLINE_PAYMENT_MAXIMUM,
    };
  }

  /** For an admin: why online payment is switched off, if it is. */
  setup() {
    const { config, missing } = this.gateway.config();

    return {
      online: config !== null,
      sandbox: config !== null && !config.live,
      missing,
    };
  }

  /**
   * Places an order and, when the customer chose to pay online, starts
   * the payment. The answer is the order; for an online payment it also
   * carries `payment.gatewayUrl`, the page to send the customer to.
   */
  async checkout(dto: PlaceOrderDto, idempotencyKey?: string, customerId?: string) {
    const online = (dto.paymentMethod ?? 'cod') !== 'cod';

    // Refuse before anything is saved, rather than save and cancel.
    if (online && this.gateway.config().config === null) {
      throw new ServiceUnavailableException(NOT_AVAILABLE);
    }

    const order = await this.orders.placeOrder(dto, idempotencyKey, customerId);

    return online ? this.startPayment(order) : order;
  }

  private async startPayment(order: any) {
    if (order.paymentStatus === 'paid') {
      return order;
    }

    if (order.status !== 'pending') {
      throw new ConflictException(
        'The payment for that order did not go through and the order was cancelled. Place the order again.',
      );
    }

    // A repeated request (double click, retry) reuses the session already made.
    const existing = await this.payments.findOne({ tranId: order.orderNumber }).lean();

    if (existing) {
      if (existing.status === 'started' && existing.gatewayUrl) {
        return { ...order, payment: { gatewayUrl: existing.gatewayUrl } };
      }

      throw new ConflictException(
        'A payment was already attempted for that order. Place the order again.',
      );
    }

    const { config } = this.gateway.config();

    if (!config) {
      await this.orders.cancelUnpaidOnlineOrder(order.orderNumber, 'failed', 'system');

      throw new ServiceUnavailableException(NOT_AVAILABLE);
    }

    let session: { gatewayUrl: string; sessionKey: string };

    try {
      session = await this.gateway.createSession(config, order);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      // Shows up in the API's logs; the customer gets a plain message.
      console.error('[payments] could not start', order.orderNumber, reason);

      await this.payments
        .create({
          orderNumber: order.orderNumber,
          tranId: order.orderNumber,
          amount: order.total,
          status: 'failed',
          sandbox: !config.live,
          problem: reason,
          events: [{ at: new Date(), source: 'start', note: reason }],
        })
        .catch(() => undefined);

      await this.orders.cancelUnpaidOnlineOrder(order.orderNumber, 'failed', 'system');

      throw new BadGatewayException(
        'Online payment could not be started, so your order was not placed. Try again, or choose cash on delivery.',
      );
    }

    await this.payments.create({
      orderNumber: order.orderNumber,
      tranId: order.orderNumber,
      amount: order.total,
      status: 'started',
      sandbox: !config.live,
      sessionKey: session.sessionKey,
      gatewayUrl: session.gatewayUrl,
      events: [{ at: new Date(), source: 'start', note: 'Customer sent to SSLCOMMERZ.' }],
    });

    return { ...order, payment: { gatewayUrl: session.gatewayUrl } };
  }

  /** Where the customer's browser goes after the gateway. */
  returnUrl(result: { orderNumber: string | null; outcome: GatewayOutcome }): string | null {
    const storefrontUrl = (process.env.STOREFRONT_URL ?? '').trim().replace(/\/+$/, '');

    if (!storefrontUrl) {
      return null;
    }

    return result.orderNumber
      ? `${storefrontUrl}/order-confirmation/${encodeURIComponent(result.orderNumber)}?payment=${result.outcome}`
      : `${storefrontUrl}/cart`;
  }

  /**
   * Handles what SSLCOMMERZ sends: the customer coming back (success,
   * fail, cancel) and the server-to-server notification (ipn).
   */
  async handleNotification(
    source: NotificationSource,
    body: Record<string, unknown>,
  ): Promise<{ orderNumber: string | null; outcome: GatewayOutcome }> {
    const tranId = String(body.tran_id ?? '').trim();

    if (!tranId) {
      return { orderNumber: null, outcome: 'pending' };
    }

    const payment = await this.payments.findOne({ tranId }).lean();

    if (!payment) {
      return { orderNumber: null, outcome: 'pending' };
    }

    const orderNumber = payment.orderNumber;

    if (payment.status === 'paid') {
      await this.markOrderPaid(payment);

      return { orderNumber, outcome: 'paid' };
    }

    const { config } = this.gateway.config();

    if (!config) {
      await this.note(tranId, source, 'Ignored: online payment is not configured.');

      return { orderNumber, outcome: 'pending' };
    }

    const reported = outcomeForStatus(body.status);
    const valId = String(body.val_id ?? '').trim();

    if (reported === 'paid') {
      return { orderNumber, outcome: await this.validate(config, payment, valId, source) };
    }

    if (reported === 'failed' || reported === 'cancelled') {
      /*
       * These addresses are public, so anyone could post "failed" for an
       * order number. Only a message signed by SSLCOMMERZ may cancel.
       */
      if (!verifySign(body, config.storePassword)) {
        await this.note(
          tranId,
          source,
          `"${String(body.status)}" arrived without a valid signature; nothing was changed.`,
        );

        return { orderNumber, outcome: 'pending' };
      }

      if (payment.status === 'started') {
        await this.payments.updateOne(
          { tranId, status: 'started' },
          {
            $set: { status: reported, problem: `SSLCOMMERZ reported ${String(body.status)}.` },
            $push: { events: { at: new Date(), source, note: `Reported ${String(body.status)}.` } },
          },
        );

        await this.orders.cancelUnpaidOnlineOrder(orderNumber, reported, 'sslcommerz');
      }

      return { orderNumber, outcome: reported };
    }

    await this.note(tranId, source, `Status "${String(body.status ?? '')}" needs no action yet.`);

    return { orderNumber, outcome: 'pending' };
  }

  /**
   * For an admin: asks SSLCOMMERZ what happened to an order's payment.
   * Useful when the customer paid but never came back and no server
   * notification arrived.
   */
  async check(orderNumber: string): Promise<{ outcome: GatewayOutcome; message: string }> {
    const payment = await this.payments
      .findOne({ orderNumber: orderNumber.trim().toUpperCase() })
      .lean();

    if (!payment) {
      throw new NotFoundException('This order has no online payment.');
    }

    if (payment.status === 'paid') {
      await this.markOrderPaid(payment);

      return { outcome: 'paid', message: 'SSLCOMMERZ has already confirmed this payment.' };
    }

    const { config } = this.gateway.config();

    if (!config) {
      throw new ServiceUnavailableException('Online payment is not configured on the API.');
    }

    let attempts: ValidationResult[];

    try {
      attempts = await this.gateway.attemptsFor(config, payment.tranId);
    } catch (error) {
      throw new BadGatewayException(
        error instanceof GatewayError ? error.message : 'SSLCOMMERZ could not be reached.',
      );
    }

    const successful = attempts.find((attempt) => outcomeForStatus(attempt.status) === 'paid');

    if (successful) {
      const outcome = await this.apply(config, payment, successful, 'check');

      return {
        outcome,
        message:
          outcome === 'paid'
            ? 'SSLCOMMERZ confirms the payment. The order is now marked paid.'
            : 'SSLCOMMERZ shows a payment that does not match this order. Look at it in the SSLCOMMERZ panel before doing anything else.',
      };
    }

    await this.note(payment.tranId, 'check', `${attempts.length} attempt(s), none successful.`);

    return {
      outcome: 'pending',
      message:
        attempts.length === 0
          ? 'SSLCOMMERZ has no payment attempt for this order.'
          : `SSLCOMMERZ shows ${attempts.length} attempt(s) for this order and none was successful.`,
    };
  }

  private async validate(
    config: SslcommerzConfig,
    payment: PaymentRecord,
    valId: string,
    source: string,
  ): Promise<GatewayOutcome> {
    if (!valId) {
      await this.note(payment.tranId, source, 'Reported as paid without a validation id.');

      return 'pending';
    }

    let result: ValidationResult;

    try {
      result = await this.gateway.validate(config, valId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      await this.note(payment.tranId, source, `Could not be validated yet: ${reason}`);

      return 'pending';
    }

    return this.apply(config, payment, result, source);
  }

  /** Accepts a payment only when SSLCOMMERZ's own record matches the order. */
  private async apply(
    config: SslcommerzConfig,
    payment: PaymentRecord,
    result: ValidationResult,
    source: string,
  ): Promise<GatewayOutcome> {
    const problem = whyNotPaid(result, { tranId: payment.tranId, amount: payment.amount });

    if (problem) {
      // Money may have moved without matching the order: a person must look.
      const needsReview = outcomeForStatus(result.status) === 'paid';

      await this.payments.updateOne(
        { tranId: payment.tranId, status: { $ne: 'paid' } },
        {
          ...(needsReview ? { $set: { status: 'review', problem } } : {}),
          $push: { events: { at: new Date(), source, note: problem } },
        },
      );

      console.error('[payments] not accepted', payment.orderNumber, problem);

      return 'pending';
    }

    const paidAt = new Date();
    const storeAmount = Number(result.store_amount);

    await this.payments.updateOne(
      { tranId: payment.tranId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          valId: String(result.val_id ?? ''),
          bankTranId: String(result.bank_tran_id ?? ''),
          cardType: String(result.card_type ?? ''),
          cardBrand: String(result.card_brand ?? ''),
          cardIssuer: String(result.card_issuer ?? ''),
          cardNo: String(result.card_no ?? ''),
          storeAmount: Number.isFinite(storeAmount) ? storeAmount : null,
          riskLevel: String(result.risk_level ?? ''),
          riskTitle: String(result.risk_title ?? ''),
          problem: '',
          paidAt,
        },
        $push: {
          events: { at: paidAt, source, note: 'Payment confirmed by SSLCOMMERZ.' },
        },
      },
    );

    await this.orders.recordOnlinePayment(payment.orderNumber, {
      provider: 'sslcommerz',
      bankTranId: String(result.bank_tran_id ?? ''),
      channel: String(result.card_type ?? ''),
      amount: payment.amount,
      paidAt,
      riskLevel: String(result.risk_level ?? ''),
      riskTitle: String(result.risk_title ?? ''),
      sandbox: !config.live,
    });

    return 'paid';
  }

  /** Repeats the order update for a payment already confirmed; it changes nothing if the order is up to date. */
  private async markOrderPaid(payment: PaymentRecord): Promise<void> {
    await this.orders.recordOnlinePayment(payment.orderNumber, {
      provider: 'sslcommerz',
      bankTranId: payment.bankTranId,
      channel: payment.cardType,
      amount: payment.amount,
      paidAt: payment.paidAt ?? new Date(),
      riskLevel: payment.riskLevel,
      riskTitle: payment.riskTitle,
      sandbox: payment.sandbox,
    });
  }

  private async note(tranId: string, source: string, text: string): Promise<void> {
    await this.payments.updateOne(
      { tranId },
      { $push: { events: { at: new Date(), source, note: text } } },
    );
  }
}
