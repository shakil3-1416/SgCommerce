/**
 * Ways of paying, as the shop presents them.
 *
 * Which methods are on offer comes from the API (GET /payments/methods),
 * so switching online payment on or off needs no change here.
 */

export interface PaymentMethods {
  cod: boolean;
  online: boolean;
  /** True while the gateway is in test mode: no real money moves. */
  sandbox: boolean;
  minimum: number;
  maximum: number;
}

export type PaymentMethod = 'cod' | 'sslcommerz';

/** Used until the API has answered, and whenever it cannot be reached. */
export const CASH_ON_DELIVERY_ONLY: PaymentMethods = {
  cod: true,
  online: false,
  sandbox: false,
  minimum: 10,
  maximum: 500000,
};

/** Reads the API's answer defensively: anything unexpected means cash on delivery only. */
export function readPaymentMethods(value: unknown): PaymentMethods {
  if (typeof value !== 'object' || value === null) {
    return CASH_ON_DELIVERY_ONLY;
  }

  const answer = value as Record<string, unknown>;
  const minimum = Number(answer.minimum);
  const maximum = Number(answer.maximum);

  return {
    cod: true,
    online: answer.online === true,
    sandbox: answer.sandbox === true,
    minimum: Number.isFinite(minimum) ? minimum : CASH_ON_DELIVERY_ONLY.minimum,
    maximum: Number.isFinite(maximum) ? maximum : CASH_ON_DELIVERY_ONLY.maximum,
  };
}

/** The gateway only takes amounts within a range. */
export function canPayOnline(methods: PaymentMethods, total: number): boolean {
  return methods.online && total >= methods.minimum && total <= methods.maximum;
}

export function paymentMethodLabel(method: unknown): string {
  return method === 'sslcommerz' ? 'Online payment' : 'Cash on delivery';
}

/** Where the payment stands, in the customer's words. */
export function paymentStatusLabel(method: unknown, status: unknown): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'refunded':
      return 'Refunded';
    case 'failed':
      return 'Payment failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return method === 'sslcommerz' ? 'Awaiting payment' : 'Not paid yet';
  }
}

export type ConfirmationView =
  | 'placed'
  | 'paid'
  | 'not-completed'
  | 'cancelled-after-payment'
  | 'confirming'
  | 'unknown';

/**
 * What the "order placed" page should say. It goes by what the API
 * reports about the order, never by the address the browser arrived at.
 */
export function confirmationView(
  summary: { status?: unknown; paymentMethod?: unknown; paymentStatus?: unknown } | null,
): ConfirmationView {
  if (!summary) {
    return 'unknown';
  }

  if (summary.paymentMethod !== 'sslcommerz') {
    return 'placed';
  }

  if (summary.paymentStatus === 'paid' && summary.status !== 'cancelled') {
    return 'paid';
  }

  if (summary.status === 'cancelled') {
    // Money that arrived for a cancelled order has to go back to the customer.
    return summary.paymentStatus === 'paid' || summary.paymentStatus === 'refunded'
      ? 'cancelled-after-payment'
      : 'not-completed';
  }

  return 'confirming';
}
