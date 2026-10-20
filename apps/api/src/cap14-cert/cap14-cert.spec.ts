/**
 * Run with:
 *   pnpm --filter api test:cap14-cert   (ts-node: the schemas need decorator metadata)
 *
 * Database tests run only when CAP14_TEST_MONGODB_URI points at a throwaway
 * LOCAL MongoDB (loopback host only), e.g. a disposable container:
 *   CAP14_TEST_MONGODB_URI=mongodb://127.0.0.1:27117 pnpm --filter api test:cap14-cert
 * They never accept a remote host.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import mongoose, { type Connection } from 'mongoose';

import {
  CAP14_PREFIX,
  CAP14_RETURN_WINDOW_DAYS,
  buildCap14Fixtures,
  fixtureObjectIdHex,
} from './fixtures';
import { assertCap14Database, Cap14TargetRefused, databaseNameFromUri } from './guard';
import { buildCap14Manifest } from './manifest';
import { CAP14_MARKERS, seedCap14 } from './seed';

describe('CAP-14 database guard', () => {
  for (const name of ['production', 'sgcommerce', 'main', 'default', 'test', '', 'sgcommerce_test',
    'prod_cap14_cert', 'production_cap14_cert', 'sgcommerce_main_cap14_cert', 'live_cap14_cert']) {
    it(`refuses "${name}"`, () => {
      assert.throws(() => assertCap14Database(name), Cap14TargetRefused);
    });
  }

  for (const name of ['sgcommerce_cap14_cert', 'sgcommerce_cap14_cert_test', 'CAP14_CERT']) {
    it(`accepts "${name}"`, () => {
      assert.equal(assertCap14Database(name), name);
    });
  }

  it('reads the database name from standard and SRV URIs only from the path', () => {
    assert.equal(databaseNameFromUri('mongodb://u:p@127.0.0.1:27017/sgcommerce_cap14_cert'), 'sgcommerce_cap14_cert');
    assert.equal(
      databaseNameFromUri('mongodb+srv://u:p@cluster0.example.mongodb.net/sgcommerce_cap14_cert?retryWrites=true'),
      'sgcommerce_cap14_cert',
    );
    assert.equal(databaseNameFromUri('mongodb://127.0.0.1:27017/?authSource=cap14_cert'), '');
    assert.equal(databaseNameFromUri('mongodb://127.0.0.1:27017'), '');
  });
});

describe('CAP-14 fixtures', () => {
  const fixtures = buildCap14Fixtures();

  it('are deterministic', () => {
    assert.deepEqual(buildCap14Fixtures(), fixtures);
    assert.deepEqual(buildCap14Manifest(buildCap14Fixtures()), buildCap14Manifest(fixtures));
    assert.equal(fixtures.customers[0].idHex, fixtureObjectIdHex('CAP14-CERT-CUSTOMER-001'));
    assert.match(fixtures.customers[0].idHex, /^[0-9a-f]{24}$/);
  });

  it('use only CAP14 identifiers and synthetic contact data', () => {
    const refs = [
      ...fixtures.products.map((item) => item.ref),
      ...fixtures.products.flatMap((item) => item.variants.map((variant) => variant.sku)),
      ...fixtures.customers.map((item) => item.ref),
      ...fixtures.orders.map((item) => item.orderNumber),
      ...fixtures.payments.map((item) => item.tranId),
      ...fixtures.returns.map((item) => item.returnNumber),
      ...fixtures.refunds.map((item) => item.refundNumber),
    ];
    for (const value of refs) assert.ok(value.startsWith(CAP14_PREFIX), value);
    assert.equal(new Set(refs).size, refs.length, 'identifiers are unique');
    for (const item of fixtures.customers) {
      assert.match(item.email, /^cap14-cert-customer-\d{3}@example\.com$/);
      assert.match(item.phone, /^00014\d+$/);
      assert.match(item.name, /^CAP14 Cert Customer \d{3}$/);
    }
    assert.deepEqual(fixtures.products.map((item) => item.ref),
      [1, 2, 3, 4, 5, 6].map((n) => `CAP14-CERT-PRODUCT-00${n}`));
    assert.deepEqual(fixtures.customers.map((item) => item.ref),
      [1, 2, 3].map((n) => `CAP14-CERT-CUSTOMER-00${n}`));
  });

  it('cover every certification case', () => {
    const variants = fixtures.products.flatMap((item) => item.variants);
    assert.ok(new Set(fixtures.products.map((item) => item.categoryRef)).size >= 3);
    assert.ok(variants.some((variant) => variant.onHand === 0), 'out-of-stock variant');
    assert.ok(variants.some((variant) => variant.onHand > 0 && variant.onHand <= variant.reorderLevel), 'low stock');
    assert.ok(fixtures.products.some((item) => !item.active), 'inactive product');
    assert.ok(variants.some((variant) => variant.attributes.size), 'sizes');
    assert.ok(new Set(variants.map((variant) => variant.attributes.color)).size >= 4, 'colours');
    assert.ok(fixtures.products.some((item) => item.cases.includes('similar_variants')));
    const statuses = new Set(fixtures.orders.map((item) => item.status));
    for (const status of ['pending', 'confirmed', 'cancelled', 'shipped', 'delivered']) {
      assert.ok(statuses.has(status as never), status);
    }
    const delivered = fixtures.orders.filter((item) => item.status === 'delivered');
    const deliveredDaysAgo = (item: (typeof delivered)[number]) =>
      item.history.find((entry) => entry.status === 'delivered')!.daysAgo;
    assert.ok(delivered.some((item) => deliveredDaysAgo(item) < CAP14_RETURN_WINDOW_DAYS
      && item.returnEligibleBySupgentPolicy === true));
    assert.ok(delivered.some((item) => deliveredDaysAgo(item) > CAP14_RETURN_WINDOW_DAYS
      && item.returnEligibleBySupgentPolicy === false));
    assert.ok(fixtures.orders.some((item) => item.status === 'shipped' && item.trackingNumber));
    assert.ok(fixtures.orders.some((item) => item.lines.length > 1), 'multi-item order');
    const perCustomer = new Map<string, number>();
    for (const item of fixtures.orders) perCustomer.set(item.customerRef, (perCustomer.get(item.customerRef) ?? 0) + 1);
    assert.ok([...perCustomer.values()].some((n) => n >= 3), 'one customer owns several orders');
    assert.ok(fixtures.payments.some((item) => item.provider === 'cod' && item.status === 'started'));
    assert.ok(fixtures.payments.some((item) => item.status === 'paid' && item.sandbox));
    assert.equal(fixtures.returns.length, 1);
    assert.equal(fixtures.refunds.length, 1);
  });

  it('keep the committed manifest in sync', () => {
    const committed = JSON.parse(readFileSync(join(__dirname, 'cap14-cert-manifest.json'), 'utf8'));
    assert.deepEqual(committed, JSON.parse(JSON.stringify(buildCap14Manifest(fixtures))));
  });

  it('seed code reaches only MongoDB (no provider, HTTP, SupGent or Nest module)', () => {
    for (const file of ['seed.ts', 'fixtures.ts', 'guard.ts', 'manifest.ts', '../seed-cap14-cert.ts']) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
      for (const name of imports) {
        assert.ok(
          ['mongoose', 'node:crypto', 'node:fs'].includes(name) || name.startsWith('./')
            || name.startsWith('../modules/') && name.includes('/schemas/') || name.startsWith('./cap14-cert/'),
          `${file} imports ${name}`,
        );
      }
      assert.doesNotMatch(source, /\bfetch\(|axios|https?:\/\/(?!localhost)[a-z]/i, file);
    }
  });
});

const TEST_URI = (process.env.CAP14_TEST_MONGODB_URI ?? '').trim().replace(/\/+$/, '');
const LOCAL = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(TEST_URI);

describe('CAP-14 seed against a throwaway local MongoDB', { skip: !LOCAL && 'CAP14_TEST_MONGODB_URI not set to a loopback server' }, () => {
  const fixtures = buildCap14Fixtures();
  let cert: Connection;
  let other: Connection;
  const network: string[] = [];
  const originals = { fetch: globalThis.fetch, http: http.request, https: https.request };

  before(async () => {
    cert = await mongoose.createConnection(`${TEST_URI}/sgcommerce_cap14_cert_spec`).asPromise();
    other = await mongoose.createConnection(`${TEST_URI}/sgcommerce_spec_production_like`).asPromise();
    await cert.dropDatabase();
    await other.dropDatabase();
    // Any provider / webhook / SupGent call would go through these.
    globalThis.fetch = (async (...args: unknown[]) => { network.push(String(args[0])); throw new Error('network'); }) as typeof fetch;
    (http as { request: unknown }).request = (...args: unknown[]) => { network.push(String(args[0])); throw new Error('network'); };
    (https as { request: unknown }).request = (...args: unknown[]) => { network.push(String(args[0])); throw new Error('network'); };
  });

  after(async () => {
    globalThis.fetch = originals.fetch;
    (http as { request: unknown }).request = originals.http;
    (https as { request: unknown }).request = originals.https;
    await cert?.dropDatabase();
    await other?.dropDatabase();
    await cert?.close();
    await other?.close();
  });

  it('refuses a non-cap14 database before writing anything', async () => {
    await assert.rejects(seedCap14(other, fixtures, { now: new Date() }), Cap14TargetRefused);
    const collections = await other.db!.listCollections().toArray();
    assert.deepEqual(collections, []);
  });

  it('seeds every fixture, idempotently, without network calls', async () => {
    const unrelated = await cert.collection('orders').insertOne({ orderNumber: 'SGO-0000001', note: 'not ours' });
    const first = await seedCap14(cert, fixtures, { now: new Date() });
    const counts = async () => Object.fromEntries(await Promise.all(Object.keys(CAP14_MARKERS).map(
      async (name) => [name, await cert.collection(name).countDocuments(CAP14_MARKERS[name] as never)],
    )));
    const once = await counts();
    const second = await seedCap14(cert, fixtures, { now: new Date() });
    assert.deepEqual(await counts(), once);
    assert.deepEqual(second.upserted, first.upserted);
    assert.deepEqual(once, {
      categories: 3, products: 6, inventory: 16, stock_movements: 0, customers: 3, orders: 7, payments: 2,
      returns: 1, refunds: 1,
    });
    assert.deepEqual(network, []);
    // Deterministic identities and exact stock.
    const customer = await cert.collection('customers').findOne({ email: 'cap14-cert-customer-001@example.com' });
    assert.equal(String(customer!._id), fixtureObjectIdHex('CAP14-CERT-CUSTOMER-001'));
    const outOfStock = await cert.collection('inventory').findOne({ sku: 'CAP14-CERT-P002-NVY-M' });
    assert.equal(outOfStock!.onHand, 0);
    const delivered = await cert.collection('orders').findOne({ orderNumber: 'CAP14-CERT-ORDER-004' });
    assert.equal(delivered!.status, 'delivered');
    assert.equal(delivered!.customerId.toString(), fixtureObjectIdHex('CAP14-CERT-CUSTOMER-001'));
    const paid = await cert.collection('payments').findOne({ tranId: 'CAP14-CERT-PAYMENT-002' });
    assert.equal(paid!.sandbox, true);
    assert.ok(await cert.collection('orders').findOne({ _id: unrelated.insertedId }), 'unrelated order untouched');
  });

  it('reset removes only CAP14 fixtures and re-seeds them', async () => {
    await cert.collection('products').insertOne({ name: 'Not ours', slug: 'not-ours', variants: [] });
    const result = await seedCap14(cert, fixtures, { now: new Date(), reset: true });
    assert.equal(result.reset!.orders, 7);
    assert.ok(await cert.collection('products').findOne({ slug: 'not-ours' }));
    assert.ok(await cert.collection('orders').findOne({ orderNumber: 'SGO-0000001' }));
    assert.equal(await cert.collection('orders').countDocuments({ orderNumber: /^CAP14-CERT-/ }), 7);
  });
});
