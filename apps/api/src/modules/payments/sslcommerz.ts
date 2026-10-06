import { createHash } from 'node:crypto';

/*
 * SSLCOMMERZ (API v4): the parts that are plain data and arithmetic, kept
 * free of network and database code so they can be tested on their own.
 *
 * Official integration document: https://developer.sslcommerz.com/doc/v4/
 */

export const SSLCOMMERZ_SANDBOX = 'https://sandbox.sslcommerz.com';
export const SSLCOMMERZ_LIVE = 'https://securepay.sslcommerz.com';

/** SSLCOMMERZ processes between 10.00 and 500000.00 BDT per transaction. */
export const ONLINE_PAYMENT_MINIMUM = 10;
export const ONLINE_PAYMENT_MAXIMUM = 500000;

export function isWithinOnlinePaymentLimits(total: number): boolean {
  return (
    Number.isFinite(total) &&
    total >= ONLINE_PAYMENT_MINIMUM &&
    total <= ONLINE_PAYMENT_MAXIMUM
  );
}

export interface SslcommerzConfig {
  storeId: string;
  storePassword: string;
  live: boolean;
  /** Public base address of this API, without a trailing slash. */
  apiUrl: string;
  /** Public address of the shop, without a trailing slash. */
  storefrontUrl: string;
}

export interface SessionOrder {
  orderNumber: string;
  total: number;
  customer: { name: string; phone: string; email?: string };
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    area?: string;
    postalCode?: string;
  };
  items: Array<{ productName: string; quantity: number }>;
}

/** Amounts go to the gateway as "1234.50". */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Compares two money values to the paisa, whether they arrive as numbers
 * or as the strings the gateway sends ("1030.00").
 */
export function sameAmount(a: unknown, b: unknown): boolean {
  const left = Math.round(Number(a) * 100);
  const right = Math.round(Number(b) * 100);

  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function clip(value: string, length: number): string {
  return value.length > length ? value.slice(0, length) : value;
}

/**
 * The fields of the "create session" request. The order number is the
 * transaction id, so a payment can be found from an order and back, here
 * and in the SSLCOMMERZ merchant panel.
 */
export function buildSessionFields(
  config: SslcommerzConfig,
  order: SessionOrder,
): Record<string, string> {
  const callbacks = `${config.apiUrl}/payments/sslcommerz`;
  const address = order.shippingAddress;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  /*
   * SSLCOMMERZ sends its receipt to this address and requires one. Guests
   * may check out without an email, so a neutral placeholder is used and
   * the receipt is simply not delivered.
   */
  const email = order.customer.email?.trim() || 'no-email@example.com';
  const postcode = address.postalCode?.trim() || '0000';
  const area = address.area?.trim() || address.city;

  return {
    store_id: config.storeId,
    store_passwd: config.storePassword,
    total_amount: formatAmount(order.total),
    currency: 'BDT',
    tran_id: order.orderNumber,
    success_url: `${callbacks}/success`,
    fail_url: `${callbacks}/fail`,
    cancel_url: `${callbacks}/cancel`,
    ipn_url: `${callbacks}/ipn`,

    cus_name: clip(order.customer.name, 50),
    cus_email: clip(email, 50),
    cus_add1: clip(address.addressLine1, 50),
    cus_add2: clip(address.addressLine2 ?? '', 50),
    cus_city: clip(address.city, 50),
    cus_postcode: clip(postcode, 30),
    cus_country: 'Bangladesh',
    cus_phone: clip(order.customer.phone, 20),

    shipping_method: 'YES',
    num_of_item: String(itemCount),
    ship_name: clip(order.customer.name, 50),
    ship_add1: clip(address.addressLine1, 50),
    ship_add2: clip(address.addressLine2 ?? '', 50),
    ship_area: clip(area, 50),
    ship_city: clip(address.city, 50),
    ship_sub_city: clip(area, 50),
    ship_postcode: clip(postcode, 50),
    ship_country: 'Bangladesh',

    product_name: clip(order.items.map((item) => item.productName).join(', '), 255),
    product_category: 'general',
    product_profile: 'physical-goods',

    // Returned unchanged with every notification.
    value_a: order.orderNumber,
  };
}

/**
 * Checks the signature SSLCOMMERZ puts on its notifications.
 *
 * `verify_key` lists the fields that were signed. They are joined as
 * key=value pairs in alphabetical order together with the MD5 of the
 * store password, and the MD5 of that string must equal `verify_sign`.
 * This is the scheme of SSLCOMMERZ's own libraries.
 *
 * A valid signature shows the message came from SSLCOMMERZ. A payment is
 * still only accepted after the Order Validation API confirms it.
 */
export function verifySign(
  body: Record<string, unknown>,
  storePassword: string,
): boolean {
  const sign = body.verify_sign;
  const keys = body.verify_key;

  if (typeof sign !== 'string' || typeof keys !== 'string' || sign === '' || keys === '') {
    return false;
  }

  const fields: Record<string, string> = {
    store_passwd: createHash('md5').update(storePassword).digest('hex'),
  };

  for (const key of keys.split(',')) {
    if (key !== '') {
      fields[key] = body[key] === undefined || body[key] === null ? '' : String(body[key]);
    }
  }

  const text = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('&');

  const expected = createHash('md5').update(text).digest('hex');

  return expected === sign.toLowerCase();
}

export type GatewayOutcome = 'paid' | 'failed' | 'cancelled' | 'pending';

/** What a notification's `status` means for the order. */
export function outcomeForStatus(status: unknown): GatewayOutcome {
  switch (String(status ?? '').toUpperCase()) {
    case 'VALID':
    case 'VALIDATED':
      return 'paid';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
    case 'EXPIRED':
    case 'UNATTEMPTED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export interface ValidationResult {
  status?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  store_amount?: string;
  currency?: string;
  currency_type?: string;
  currency_amount?: string;
  bank_tran_id?: string;
  card_type?: string;
  card_no?: string;
  card_issuer?: string;
  card_brand?: string;
  risk_level?: string;
  risk_title?: string;
  [key: string]: unknown;
}

/**
 * Decides whether a validation answer really is payment in full for this
 * order. Returns '' when it is, otherwise the reason it is not.
 *
 * SSLCOMMERZ's checklist: the transaction must exist in our records, and
 * the amount and the currency must match what we asked for.
 */
export function whyNotPaid(
  result: ValidationResult,
  expected: { tranId: string; amount: number },
): string {
  const status = String(result.status ?? '').toUpperCase();

  if (status !== 'VALID' && status !== 'VALIDATED') {
    return `SSLCOMMERZ answered "${result.status ?? 'nothing'}" for this payment.`;
  }

  if (result.tran_id !== expected.tranId) {
    return 'The payment belongs to a different transaction.';
  }

  if (String(result.currency_type ?? '').toUpperCase() !== 'BDT') {
    return `The payment was made in ${result.currency_type ?? 'an unknown currency'}, not BDT.`;
  }

  if (!sameAmount(result.currency_amount, expected.amount)) {
    return `The amount paid (${result.currency_amount}) does not match the order total (${formatAmount(expected.amount)}).`;
  }

  if (String(result.currency ?? '').toUpperCase() !== 'BDT' || !sameAmount(result.amount, expected.amount)) {
    return `The amount settled (${result.amount} ${result.currency}) does not match the order total (${formatAmount(expected.amount)} BDT).`;
  }

  return '';
}
