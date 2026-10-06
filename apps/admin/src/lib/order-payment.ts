/**
 * How an order's payment is described to the merchant, and what the
 * merchant can do about it. Pure, so it can be tested without a browser.
 */

export interface PaymentNotice {
  tone: 'info' | 'warning' | 'action';
  text: string;
}

export interface PaymentDescription {
  method: string;
  status: string;
  /** Short form for the orders list, for example "Online · Paid". */
  short: string;
  details: string[];
  notice: PaymentNotice | null;
  /** Ask SSLCOMMERZ what happened to the payment. */
  canCheck: boolean;
  /** The refund has been made in the SSLCOMMERZ panel; record it. */
  canMarkRefunded: boolean;
}

interface OrderLike {
  status?: unknown;
  total?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  payment?: {
    channel?: unknown;
    bankTranId?: unknown;
    amount?: unknown;
    paidAt?: unknown;
    riskLevel?: unknown;
    riskTitle?: unknown;
    sandbox?: unknown;
  } | null;
}

function statusLabel(online: boolean, status: unknown): string {
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
      return online ? 'Not paid yet' : 'To collect on delivery';
  }
}

export function describePayment(
  order: OrderLike,
  formatTime: (value: unknown) => string,
): PaymentDescription {
  const online = order.paymentMethod === 'sslcommerz';
  const status = statusLabel(online, order.paymentStatus);
  const payment = order.payment ?? null;

  const description: PaymentDescription = {
    method: online ? 'Online payment (SSLCOMMERZ)' : 'Cash on delivery',
    status,
    short: `${online ? 'Online' : 'Cash on delivery'} · ${status}`,
    details: [],
    notice: null,
    canCheck: false,
    canMarkRefunded: false,
  };

  if (!online) {
    return description;
  }

  if (payment) {
    if (payment.channel) {
      description.details.push(`Paid with ${String(payment.channel)}`);
    }

    if (payment.bankTranId) {
      description.details.push(`Bank transaction ${String(payment.bankTranId)}`);
    }

    const paidAt = formatTime(payment.paidAt);

    if (paidAt) {
      description.details.push(`Confirmed ${paidAt}`);
    }

    if (payment.sandbox === true) {
      description.details.push('Test payment: no real money was taken');
    }
  }

  const paid = order.paymentStatus === 'paid';

  // The payment may have arrived without the shop hearing about it.
  description.canCheck = !paid && order.paymentStatus !== 'refunded';

  if (paid && order.status === 'cancelled') {
    description.canMarkRefunded = true;
    description.notice = {
      tone: 'action',
      text: `Refund due: ৳${String(payment?.amount ?? order.total ?? '')}. This order was paid online and then cancelled. Refund it in the SSLCOMMERZ merchant panel, then mark it as refunded here.`,
    };
  } else if (paid && String(payment?.riskLevel ?? '') === '1') {
    description.notice = {
      tone: 'warning',
      text: `SSLCOMMERZ marked this payment as risky${payment?.riskTitle ? ` (${String(payment.riskTitle)})` : ''}. Verify the customer before you ship.`,
    };
  } else if (order.paymentStatus === 'pending' && order.status === 'pending') {
    description.notice = {
      tone: 'info',
      text: 'Not paid yet. The customer may still be on the payment page. The order cannot be confirmed until it is paid.',
    };
  } else if (order.paymentStatus === 'failed') {
    description.notice = {
      tone: 'info',
      text: 'The payment did not go through, and the order was cancelled automatically.',
    };
  }

  return description;
}
