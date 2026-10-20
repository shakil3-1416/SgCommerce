/**
 * CAP-14 certification seed: upserts the fixtures of ./fixtures.ts into a
 * `*cap14_cert*` database through the application's own Mongoose schemas.
 *
 * Safety:
 * - the connected database name is checked (./guard.ts) before any write;
 * - every write is an upsert keyed by a CAP14-CERT-* (or cap14-cert-*)
 *   identifier, and the optional reset deletes only documents matching those
 *   anchored markers: no drop, no truncate, nothing else is ever touched;
 * - it talks only to MongoDB: no payment provider, courier, SupGent or
 *   webhook call, and no Nest application (so no module side effects).
 *
 * Re-running is idempotent: the same documents (deterministic _id values)
 * are updated in place, and CAP-14 stock is reset to its known levels.
 */
import { Types, type Connection, type Model, type Schema } from 'mongoose';

import { CategorySchema } from '../modules/catalog/schemas/category.schema';
import { ProductSchema } from '../modules/catalog/schemas/product.schema';
import { CustomerSchema } from '../modules/customers/schemas/customer.schema';
import { InventorySchema } from '../modules/inventory/schemas/inventory.schema';
import { OrderSchema } from '../modules/orders/schemas/order.schema';
import { PaymentSchema } from '../modules/payments/schemas/payment.schema';
import { RefundSchema } from '../modules/refunds/schemas/refund.schema';
import { ReturnRequestSchema } from '../modules/returns/schemas/return.schema';
import {
  CAP14_ACTOR,
  CAP14_CATALOG_SOURCE,
  CAP14_EMAIL_DOMAIN,
  CAP14_PREFIX,
  CAP14_SLUG_PREFIX,
  type Cap14Fixtures,
  daysBefore,
  findVariant,
  fixtureObjectIdHex,
  orderTotals,
} from './fixtures';
import { assertCap14Database } from './guard';

export interface Cap14SeedResult {
  database: string;
  reset: Record<string, number> | null;
  upserted: Record<string, number>;
}

/** Anchored markers: the only documents the seed (and its reset) may touch. */
const PREFIX = new RegExp(`^${CAP14_PREFIX}`);
export const CAP14_MARKERS: Record<string, Record<string, unknown>> = {
  categories: { slug: new RegExp(`^${CAP14_SLUG_PREFIX}`) },
  products: { catalogSource: CAP14_CATALOG_SOURCE, productCode: PREFIX },
  inventory: { sku: PREFIX },
  stock_movements: { sku: PREFIX },
  customers: { email: new RegExp(`^cap14-cert-customer-\\d{3}@${CAP14_EMAIL_DOMAIN.replace('.', '\\.')}$`) },
  orders: { orderNumber: PREFIX },
  payments: { tranId: PREFIX },
  returns: { returnNumber: PREFIX },
  refunds: { refundNumber: PREFIX },
};

function model(connection: Connection, name: string, schema: Schema): Model<any> {
  return connection.models[name] ?? connection.model(name, schema);
}

const oid = (hex: string) => new Types.ObjectId(hex);
const UPSERT = { upsert: true, runValidators: true, timestamps: false } as const;

export async function seedCap14(
  connection: Connection,
  fixtures: Cap14Fixtures,
  options: { now: Date; reset?: boolean },
): Promise<Cap14SeedResult> {
  const database = assertCap14Database(connection.db?.databaseName ?? '');
  const { now } = options;
  const models = {
    categories: model(connection, 'Category', CategorySchema),
    products: model(connection, 'Product', ProductSchema),
    inventory: model(connection, 'Inventory', InventorySchema),
    customers: model(connection, 'Customer', CustomerSchema),
    orders: model(connection, 'Order', OrderSchema),
    payments: model(connection, 'Payment', PaymentSchema),
    returns: model(connection, 'ReturnRequest', ReturnRequestSchema),
    refunds: model(connection, 'Refund', RefundSchema),
  };

  let reset: Record<string, number> | null = null;
  if (options.reset) {
    reset = {};
    for (const [collection, filter] of Object.entries(CAP14_MARKERS)) {
      const result = await connection.collection(collection).deleteMany(filter);
      reset[collection] = result.deletedCount ?? 0;
    }
  }

  const upserted: Record<string, number> = {};
  const count = (key: string) => { upserted[key] = (upserted[key] ?? 0) + 1; };
  const stamps = (createdDaysAgo: number) => ({ createdAt: daysBefore(now, createdDaysAgo), updatedAt: now });

  const categoryIds = new Map<string, Types.ObjectId>();
  for (const category of fixtures.categories) {
    const id = oid(fixtureObjectIdHex(`category:${category.slug}`));
    await models.categories.updateOne(
      { slug: category.slug },
      { $set: { name: category.name, description: category.description, active: true, ...stamps(30) },
        $setOnInsert: { _id: id } },
      UPSERT,
    );
    const stored = await models.categories.findOne({ slug: category.slug }, { _id: 1 }).lean<{ _id: Types.ObjectId }>();
    categoryIds.set(category.ref, stored!._id);
    count('categories');
  }

  for (const item of fixtures.products) {
    await models.products.updateOne(
      { catalogSource: CAP14_CATALOG_SOURCE, externalId: item.ref },
      {
        $set: {
          name: item.name, slug: item.slug, description: item.description, brand: item.brand,
          category: categoryIds.get(item.categoryRef), active: item.active, images: [],
          productCode: item.ref, lastVariantNumber: item.variants.length,
          variants: item.variants.map((variant) => ({
            sku: variant.sku, title: variant.title, attributes: variant.attributes, price: variant.price,
            ...(variant.compareAtPrice !== undefined ? { compareAtPrice: variant.compareAtPrice } : {}),
            active: variant.active,
          })),
          ...stamps(30),
        },
        $setOnInsert: { _id: oid(item.idHex) },
      },
      UPSERT,
    );
    count('products');
    for (const variant of item.variants) {
      await models.inventory.updateOne(
        { sku: variant.sku },
        {
          $set: {
            productId: oid(item.idHex), productName: item.name, variantTitle: variant.title,
            onHand: variant.onHand, reserved: 0, reorderLevel: variant.reorderLevel, ...stamps(30),
          },
          $setOnInsert: { _id: oid(fixtureObjectIdHex(`inventory:${variant.sku}`)) },
        },
        UPSERT,
      );
      count('inventory');
    }
  }

  for (const item of fixtures.customers) {
    await models.customers.updateOne(
      { phone: item.phone },
      {
        $set: {
          name: item.name, email: item.email, active: true,
          addresses: [{ ...item.address, addressLine2: '', isDefault: true }], ...stamps(40),
        },
        $setOnInsert: { _id: oid(item.idHex) },
      },
      UPSERT,
    );
    count('customers');
  }

  const customersByRef = new Map(fixtures.customers.map((item) => [item.ref, item]));
  const ordersByRef = new Map(fixtures.orders.map((item) => [item.ref, item]));
  const paymentsByOrder = new Map(fixtures.payments.map((item) => [item.orderRef, item]));
  for (const item of fixtures.orders) {
    const owner = customersByRef.get(item.customerRef)!;
    const totals = orderTotals(fixtures, item);
    const payment = paymentsByOrder.get(item.ref);
    const created = Math.max(...item.history.map((entry) => entry.daysAgo));
    await models.orders.updateOne(
      { orderNumber: item.orderNumber },
      {
        $set: {
          // The orders index on idempotencyKey is unique+sparse with a null
          // default, so every fixture order carries its own deterministic key.
          idempotencyKey: `cap14-cert:${item.orderNumber}`,
          customerId: oid(owner.idHex),
          customer: { name: owner.name, phone: owner.phone, email: owner.email },
          items: totals.lines.map((line) => ({
            productId: oid(line.product.idHex), productCode: line.product.ref, productSlug: line.product.slug,
            productName: line.product.name, sku: line.sku, variantTitle: line.variant.title,
            unitPrice: line.variant.price, quantity: line.quantity, lineTotal: line.lineTotal,
          })),
          shippingAddress: {
            addressLine1: owner.address.addressLine1, addressLine2: '', city: owner.address.city,
            area: owner.address.area, postalCode: owner.address.postalCode, zone: owner.address.zone,
          },
          subtotal: totals.subtotal, shippingFee: item.shippingFee, total: totals.total, currency: 'BDT',
          paymentMethod: item.paymentMethod, paymentStatus: item.paymentStatus, status: item.status,
          trackingNumber: item.trackingNumber,
          statusHistory: item.history.map((entry) => ({
            status: entry.status,
            paymentStatus: entry.status === item.status ? item.paymentStatus : 'pending',
            trackingNumber: entry.status === 'shipped' || entry.status === item.status ? item.trackingNumber : '',
            changedBy: CAP14_ACTOR, actorType: 'seed', actorId: CAP14_ACTOR, requestId: '',
            at: daysBefore(now, entry.daysAgo),
          })),
          payment: payment && payment.status === 'paid'
            ? { provider: payment.provider, bankTranId: `${payment.tranId}-SANDBOX`, channel: 'cap14-cert-sandbox',
                amount: totals.total, paidAt: daysBefore(now, payment.paidDaysAgo ?? 0), riskLevel: '',
                riskTitle: '', sandbox: true }
            : null,
          ...stamps(created),
        },
        $setOnInsert: { _id: oid(item.idHex) },
      },
      UPSERT,
    );
    count('orders');
  }

  for (const item of fixtures.payments) {
    const owner = ordersByRef.get(item.orderRef)!;
    const totals = orderTotals(fixtures, owner);
    await models.payments.updateOne(
      { tranId: item.tranId },
      {
        $set: {
          orderNumber: owner.orderNumber, provider: item.provider, amount: totals.total, currency: 'BDT',
          status: item.status, sandbox: true,
          bankTranId: item.status === 'paid' ? `${item.tranId}-SANDBOX` : '',
          paidAt: item.paidDaysAgo === null ? null : daysBefore(now, item.paidDaysAgo),
          problem: '', events: [{ at: daysBefore(now, item.paidDaysAgo ?? 1), source: CAP14_ACTOR,
            note: 'CAP14 certification fixture; no gateway call' }],
          ...stamps(item.paidDaysAgo ?? 1),
        },
        $setOnInsert: { _id: oid(fixtureObjectIdHex(`payment:${item.tranId}`)) },
      },
      UPSERT,
    );
    count('payments');
  }

  const returnsByRef = new Map(fixtures.returns.map((item) => [item.ref, item]));
  for (const item of fixtures.returns) {
    const owner = ordersByRef.get(item.orderRef)!;
    const customerPhone = customersByRef.get(owner.customerRef)!.phone;
    const { product: returned, variant } = findVariant(fixtures, item.sku);
    await models.returns.updateOne(
      { returnNumber: item.returnNumber },
      {
        $set: {
          orderNumber: owner.orderNumber, customerPhone,
          items: [{ sku: item.sku, productName: returned.name, variantTitle: variant.title,
            quantity: item.quantity, unitPrice: variant.price, refundAmount: variant.price * item.quantity }],
          reason: item.reason, details: 'CAP14 certification fixture', status: item.status,
          refundAmount: variant.price * item.quantity, restocked: false, ...stamps(2),
        },
        $setOnInsert: { _id: oid(fixtureObjectIdHex(`return:${item.returnNumber}`)) },
      },
      UPSERT,
    );
    count('returns');
  }

  for (const item of fixtures.refunds) {
    const source = returnsByRef.get(item.returnRef)!;
    const owner = ordersByRef.get(source.orderRef)!;
    const { variant } = findVariant(fixtures, source.sku);
    await models.refunds.updateOne(
      { refundNumber: item.refundNumber },
      {
        $set: {
          returnNumber: source.returnNumber, orderNumber: owner.orderNumber,
          customerPhone: customersByRef.get(owner.customerRef)!.phone,
          amount: variant.price * source.quantity, currency: 'BDT', method: item.method, status: item.status,
          note: 'CAP14 certification fixture; records only, no money moves', ...stamps(1),
        },
        $setOnInsert: { _id: oid(fixtureObjectIdHex(`refund:${item.refundNumber}`)) },
      },
      UPSERT,
    );
    count('refunds');
  }

  return { database, reset, upserted };
}

