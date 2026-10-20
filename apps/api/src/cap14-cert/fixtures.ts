/**
 * CAP-14 certification fixtures (SupGent live capability certification).
 *
 * Pure, deterministic data: every identifier, SKU, price and stock level is
 * fixed, and every MongoDB _id is derived from the fixture reference, so the
 * seed can upsert the same documents on every run. Dates are relative to the
 * seed time (`now`) so "delivered 2 days ago" stays true whenever it runs.
 *
 * Everything is synthetic: names say "CAP14 Cert", emails use example.com
 * (RFC 2606), phones are non-dialable `00014…` strings. No real customer,
 * payment or courier data.
 */
import { createHash } from 'node:crypto';

export const CAP14_FIXTURE_VERSION = 'cap14-cert-2026-10-18';
export const CAP14_PREFIX = 'CAP14-CERT-';
export const CAP14_SLUG_PREFIX = 'cap14-cert-';
export const CAP14_CATALOG_SOURCE = 'cap14-cert';
export const CAP14_EMAIL_DOMAIN = 'example.com';
export const CAP14_ACTOR = 'cap14-cert-seed';
/** The return window SupGent's published policy states (SGCommerce enforces none). */
export const CAP14_RETURN_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 24-hex ObjectId derived from a fixture reference (stable across runs). */
export function fixtureObjectIdHex(ref: string): string {
  return createHash('sha256').update(`cap14-cert:${ref}`).digest('hex').slice(0, 24);
}

export interface Cap14Category {
  ref: string;
  slug: string;
  name: string;
  description: string;
}

export interface Cap14Variant {
  sku: string;
  title: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  active: boolean;
  onHand: number;
  reorderLevel: number;
}

export interface Cap14Product {
  ref: string;
  idHex: string;
  slug: string;
  name: string;
  description: string;
  brand: string;
  categoryRef: string;
  active: boolean;
  variants: Cap14Variant[];
  cases: string[];
}

export interface Cap14Customer {
  ref: string;
  idHex: string;
  name: string;
  email: string;
  phone: string;
  address: {
    id: string;
    label: string;
    addressLine1: string;
    city: string;
    area: string;
    postalCode: string;
    zone: 'inside_dhaka' | 'outside_dhaka';
  };
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export interface Cap14OrderLine {
  productRef: string;
  sku: string;
  quantity: number;
}

export interface Cap14Order {
  ref: string;
  idHex: string;
  orderNumber: string;
  customerRef: string;
  lines: Cap14OrderLine[];
  status: OrderStatus;
  paymentMethod: 'cod' | 'sslcommerz';
  paymentStatus: PaymentStatus;
  trackingNumber: string;
  /** Status changes as (status, days before seed time). */
  history: Array<{ status: OrderStatus; daysAgo: number }>;
  shippingFee: number;
  /** SupGent's 7-day window: true / false; null when not delivered. */
  returnEligibleBySupgentPolicy: boolean | null;
  cases: string[];
}

export interface Cap14Payment {
  ref: string;
  tranId: string;
  orderRef: string;
  provider: 'cod' | 'sslcommerz';
  status: 'started' | 'paid';
  sandbox: true;
  paidDaysAgo: number | null;
  cases: string[];
}

export interface Cap14Return {
  ref: string;
  returnNumber: string;
  orderRef: string;
  sku: string;
  quantity: number;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'received' | 'completed';
}

export interface Cap14Refund {
  ref: string;
  refundNumber: string;
  returnRef: string;
  method: 'manual';
  status: 'pending' | 'completed' | 'failed';
}

export interface Cap14Fixtures {
  version: string;
  categories: Cap14Category[];
  products: Cap14Product[];
  customers: Cap14Customer[];
  orders: Cap14Order[];
  payments: Cap14Payment[];
  returns: Cap14Return[];
  refunds: Cap14Refund[];
}

const ref = (kind: string, n: number) => `${CAP14_PREFIX}${kind}-${String(n).padStart(3, '0')}`;

function variant(
  productNumber: number,
  code: string,
  title: string,
  attributes: Record<string, string>,
  price: number,
  onHand: number,
  extra: Partial<Cap14Variant> = {},
): Cap14Variant {
  return {
    sku: `${CAP14_PREFIX}P${String(productNumber).padStart(3, '0')}-${code}`,
    title,
    attributes,
    price,
    active: true,
    onHand,
    reorderLevel: 5,
    ...extra,
  };
}

function product(
  n: number,
  name: string,
  categoryRef: string,
  brand: string,
  variants: Cap14Variant[],
  cases: string[],
  active = true,
): Cap14Product {
  const productRef = ref('PRODUCT', n);
  return {
    ref: productRef,
    idHex: fixtureObjectIdHex(productRef),
    slug: `${CAP14_SLUG_PREFIX}product-${String(n).padStart(3, '0')}`,
    name,
    description: `${name}: synthetic CAP-14 certification product. Not for sale.`,
    brand,
    categoryRef,
    active,
    variants,
    cases,
  };
}

function customer(n: number): Cap14Customer {
  const customerRef = ref('CUSTOMER', n);
  const suffix = String(n).padStart(3, '0');
  return {
    ref: customerRef,
    idHex: fixtureObjectIdHex(customerRef),
    name: `CAP14 Cert Customer ${suffix}`,
    email: `cap14-cert-customer-${suffix}@${CAP14_EMAIL_DOMAIN}`,
    // Not a dialable number in any plan: certification-only identifier.
    phone: `00014000${String(n).padStart(4, '0')}`,
    address: {
      id: `cap14-cert-address-${suffix}`,
      label: 'CAP14 Cert',
      addressLine1: `CAP14 Cert Test Road ${n}`,
      city: 'Dhaka',
      area: 'CAP14 Cert Area',
      postalCode: '1000',
      zone: 'inside_dhaka',
    },
  };
}

function order(
  n: number,
  customerRef: string,
  lines: Cap14OrderLine[],
  status: OrderStatus,
  history: Array<{ status: OrderStatus; daysAgo: number }>,
  options: {
    paymentMethod?: 'cod' | 'sslcommerz';
    paymentStatus?: PaymentStatus;
    trackingNumber?: string;
    returnEligible?: boolean | null;
    cases: string[];
  },
): Cap14Order {
  const orderRef = ref('ORDER', n);
  return {
    ref: orderRef,
    idHex: fixtureObjectIdHex(orderRef),
    orderNumber: orderRef,
    customerRef,
    lines,
    status,
    paymentMethod: options.paymentMethod ?? 'cod',
    paymentStatus: options.paymentStatus ?? 'pending',
    trackingNumber: options.trackingNumber ?? '',
    history,
    shippingFee: 60,
    returnEligibleBySupgentPolicy: options.returnEligible ?? null,
    cases: options.cases,
  };
}

/** The complete, deterministic CAP-14 fixture set. */
export function buildCap14Fixtures(): Cap14Fixtures {
  const categories: Cap14Category[] = [
    { ref: 'apparel', slug: `${CAP14_SLUG_PREFIX}apparel`, name: 'CAP14 Cert Apparel', description: 'CAP-14 certification apparel.' },
    { ref: 'electronics', slug: `${CAP14_SLUG_PREFIX}electronics`, name: 'CAP14 Cert Electronics', description: 'CAP-14 certification electronics.' },
    { ref: 'home', slug: `${CAP14_SLUG_PREFIX}home`, name: 'CAP14 Cert Home', description: 'CAP-14 certification home goods.' },
  ];

  const products: Cap14Product[] = [
    product(1, 'CAP14 Cert Cotton Tee', 'apparel', 'CAP14Basics', [
      variant(1, 'BLK-S', 'Black / S', { color: 'Black', size: 'S' }, 950, 25),
      variant(1, 'BLK-M', 'Black / M', { color: 'Black', size: 'M' }, 950, 20),
      variant(1, 'BLK-L', 'Black / L', { color: 'Black', size: 'L' }, 950, 2),
      variant(1, 'WHT-M', 'White / M', { color: 'White', size: 'M' }, 990, 12),
    ], ['multiple_sizes', 'multiple_colours', 'low_stock_variant']),
    product(2, 'CAP14 Cert Hoodie', 'apparel', 'CAP14Basics', [
      variant(2, 'GRY-M', 'Grey / M', { color: 'Grey', size: 'M' }, 2450, 8),
      variant(2, 'GRY-L', 'Grey / L', { color: 'Grey', size: 'L' }, 2450, 6),
      variant(2, 'NVY-M', 'Navy / M', { color: 'Navy', size: 'M' }, 2450, 0),
    ], ['out_of_stock_variant', 'multiple_colours']),
    product(3, 'CAP14 Cert Wireless Earbuds', 'electronics', 'CAP14Audio', [
      variant(3, 'BLK', 'Black', { color: 'Black' }, 3290, 15),
      variant(3, 'WHT', 'White', { color: 'White' }, 3290, 9),
    ], ['second_category']),
    product(4, 'CAP14 Cert Desk Lamp', 'home', 'CAP14Home', [
      variant(4, 'STD', 'Standard', { color: 'Matte Black' }, 1800, 10),
    ], ['inactive_product'], false),
    product(5, 'CAP14 Cert Ceramic Mug', 'home', 'CAP14Home', [
      variant(5, 'BLU-350', 'Blue / 350 ml', { color: 'Blue', capacity: '350 ml' }, 450, 30),
      variant(5, 'BLU-450', 'Blue / 450 ml', { color: 'Blue', capacity: '450 ml' }, 520, 30),
      variant(5, 'NVY-350', 'Navy / 350 ml', { color: 'Navy', capacity: '350 ml' }, 450, 30),
    ], ['similar_variants', 'third_category']),
    product(6, 'CAP14 Cert Running Shoes', 'apparel', 'CAP14Sport', [
      variant(6, 'BLK-40', 'Black / 40', { color: 'Black', size: '40' }, 4200, 5, { compareAtPrice: 4800 }),
      variant(6, 'BLK-41', 'Black / 41', { color: 'Black', size: '41' }, 4200, 7, { compareAtPrice: 4800 }),
      variant(6, 'BLK-42', 'Black / 42', { color: 'Black', size: '42' }, 4200, 4, { compareAtPrice: 4800 }),
    ], ['compare_at_price', 'multiple_sizes']),
  ];

  const customers = [customer(1), customer(2), customer(3)];
  const [c1, c2, c3] = customers.map((item) => item.ref);
  const tee = ref('PRODUCT', 1);
  const hoodie = ref('PRODUCT', 2);
  const earbuds = ref('PRODUCT', 3);
  const mug = ref('PRODUCT', 5);
  const shoes = ref('PRODUCT', 6);
  const sku = (productRef: string, code: string) =>
    `${CAP14_PREFIX}P${productRef.slice(-3)}-${code}`;

  const orders: Cap14Order[] = [
    order(1, c1, [{ productRef: tee, sku: sku(tee, 'BLK-M'), quantity: 1 }], 'pending',
      [{ status: 'pending', daysAgo: 1 }], { cases: ['pending', 'cod_pending_payment', 'ambiguity_customer_001'] }),
    order(2, c1, [
      { productRef: hoodie, sku: sku(hoodie, 'GRY-M'), quantity: 1 },
      { productRef: mug, sku: sku(mug, 'BLU-350'), quantity: 2 },
    ], 'confirmed', [{ status: 'pending', daysAgo: 2 }, { status: 'confirmed', daysAgo: 1 }],
    { cases: ['confirmed', 'multiple_items', 'ambiguity_customer_001'] }),
    order(3, c2, [{ productRef: earbuds, sku: sku(earbuds, 'WHT'), quantity: 1 }], 'cancelled',
      [{ status: 'pending', daysAgo: 6 }, { status: 'cancelled', daysAgo: 5 }],
      { paymentStatus: 'cancelled', cases: ['cancelled'] }),
    order(4, c1, [{ productRef: shoes, sku: sku(shoes, 'BLK-41'), quantity: 1 }], 'delivered', [
      { status: 'pending', daysAgo: 6 }, { status: 'confirmed', daysAgo: 5 },
      { status: 'shipped', daysAgo: 4 }, { status: 'delivered', daysAgo: 2 },
    ], { paymentStatus: 'paid', returnEligible: true,
      cases: ['delivered_within_return_window', 'returnable', 'ambiguity_customer_001'] }),
    order(5, c2, [{ productRef: tee, sku: sku(tee, 'WHT-M'), quantity: 2 }], 'delivered', [
      { status: 'pending', daysAgo: 50 }, { status: 'confirmed', daysAgo: 49 },
      { status: 'shipped', daysAgo: 48 }, { status: 'delivered', daysAgo: 45 },
    ], { paymentStatus: 'paid', returnEligible: false,
      cases: ['delivered_outside_return_window', 'non_returnable'] }),
    order(6, c1, [{ productRef: earbuds, sku: sku(earbuds, 'BLK'), quantity: 1 }], 'shipped', [
      { status: 'pending', daysAgo: 3 }, { status: 'confirmed', daysAgo: 2 }, { status: 'shipped', daysAgo: 1 },
    ], { trackingNumber: `${CAP14_PREFIX}TRACK-006`, cases: ['shipped_with_tracking', 'ambiguity_customer_001'] }),
    order(7, c3, [{ productRef: hoodie, sku: sku(hoodie, 'GRY-L'), quantity: 1 }], 'delivered', [
      { status: 'pending', daysAgo: 8 }, { status: 'confirmed', daysAgo: 8 },
      { status: 'shipped', daysAgo: 6 }, { status: 'delivered', daysAgo: 3 },
    ], { paymentMethod: 'sslcommerz', paymentStatus: 'paid', returnEligible: true,
      cases: ['sandbox_paid_online', 'has_return_and_refund'] }),
  ];

  const payments: Cap14Payment[] = [
    { ref: ref('PAYMENT', 1), tranId: ref('PAYMENT', 1), orderRef: ref('ORDER', 1), provider: 'cod',
      status: 'started', sandbox: true, paidDaysAgo: null, cases: ['cod_pending'] },
    { ref: ref('PAYMENT', 2), tranId: ref('PAYMENT', 2), orderRef: ref('ORDER', 7), provider: 'sslcommerz',
      status: 'paid', sandbox: true, paidDaysAgo: 8, cases: ['synthetic_paid_sandbox'] },
  ];

  const returns: Cap14Return[] = [
    { ref: ref('RETURN', 1), returnNumber: ref('RETURN', 1), orderRef: ref('ORDER', 7),
      sku: sku(hoodie, 'GRY-L'), quantity: 1, reason: 'CAP14 certification: size does not fit',
      status: 'approved' },
  ];

  const refunds: Cap14Refund[] = [
    { ref: ref('REFUND', 1), refundNumber: ref('REFUND', 1), returnRef: ref('RETURN', 1), method: 'manual',
      status: 'pending' },
  ];

  return { version: CAP14_FIXTURE_VERSION, categories, products, customers, orders, payments, returns, refunds };
}

export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function findVariant(fixtures: Cap14Fixtures, sku: string): { product: Cap14Product; variant: Cap14Variant } {
  for (const item of fixtures.products) {
    const match = item.variants.find((candidate) => candidate.sku === sku);
    if (match) return { product: item, variant: match };
  }
  throw new Error(`unknown CAP-14 SKU ${sku}`);
}

/** Order totals in BDT, from the fixed variant prices. */
export function orderTotals(fixtures: Cap14Fixtures, item: Cap14Order) {
  const lines = item.lines.map((line) => {
    const { product: owner, variant: match } = findVariant(fixtures, line.sku);
    return { ...line, product: owner, variant: match, lineTotal: match.price * line.quantity };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return { lines, subtotal, total: subtotal + item.shippingFee };
}
