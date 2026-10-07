/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/developer/developer-api.spec.ts
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  currentEnvironment,
  decodeCursor,
  dhakaDay,
  encodeCursor,
  expiryDate,
  graceEnd,
  loggedPath,
  recentDays,
  generateApiKey,
  grantableScopes,
  hashApiKey,
  idempotencyKeyProblem,
  keyEnvironment,
  keyHint,
  looksLikeApiKey,
  newApplicationId,
  newRequestId,
  pageSize,
  parsePrefixedId,
  prefixedId,
  readBearer,
  refusedScopes,
  requestFingerprint,
  SCOPES,
} from './developer-api';

describe('environment', () => {
  const before = process.env.API_ENVIRONMENT;
  afterEach(() => {
    if (before === undefined) delete process.env.API_ENVIRONMENT;
    else process.env.API_ENVIRONMENT = before;
  });

  it('is live unless the deployment says it is a sandbox', () => {
    delete process.env.API_ENVIRONMENT;
    assert.equal(currentEnvironment(), 'live');
    process.env.API_ENVIRONMENT = 'test';
    assert.equal(currentEnvironment(), 'test');
    process.env.API_ENVIRONMENT = 'anything-else';
    assert.equal(currentEnvironment(), 'live');
  });
});

describe('credentials', () => {
  it('carry their environment in the prefix and are never the same twice', () => {
    const live = generateApiKey('live');
    const test = generateApiKey('test');

    assert.match(live, /^sg_live_[0-9a-f]{40}$/);
    assert.match(test, /^sg_test_[0-9a-f]{40}$/);
    assert.equal(keyEnvironment(live), 'live');
    assert.equal(keyEnvironment(test), 'test');
    assert.notEqual(generateApiKey('live'), live);
    assert.equal(new Set(Array.from({ length: 200 }, () => generateApiKey('live'))).size, 200);
  });

  it('are recognised by shape, so anything else is refused without a database lookup', () => {
    assert.equal(looksLikeApiKey(generateApiKey('live')), true);

    for (const value of ['', 'sg_live_', 'sg_live_short', 'sg_prod_' + 'a'.repeat(40), 'sg_live_' + 'g'.repeat(40), 'sg_live_' + 'A'.repeat(40), ` sg_live_${'a'.repeat(40)}`, undefined, 42]) {
      assert.equal(looksLikeApiKey(value), false, JSON.stringify(value));
    }

    assert.equal(keyEnvironment('nonsense'), null);
  });

  it('are stored only as a SHA-256 hash', () => {
    const key = `sg_live_${'a'.repeat(40)}`;

    assert.equal(hashApiKey(key).length, 64);
    assert.equal(hashApiKey(key), hashApiKey(key));
    assert.notEqual(hashApiKey(key), hashApiKey(`sg_live_${'b'.repeat(40)}`));
    assert.ok(!hashApiKey(key).includes('aaaa'));
  });

  it('show only a hint in lists', () => {
    assert.equal(keyHint(`sg_live_${'0123456789'.repeat(4)}`), 'sg_live_0123\u20266789');
  });

  it('are read from a Bearer header only', () => {
    const key = generateApiKey('live');

    assert.equal(readBearer(`Bearer ${key}`), key);
    assert.equal(readBearer(`bearer   ${key}  `), key);
    assert.equal(readBearer([`Bearer ${key}`]), key);
    assert.equal(readBearer(key), '');
    assert.equal(readBearer(`Basic ${key}`), '');
    assert.equal(readBearer(undefined), '');
  });
});

describe('identifiers', () => {
  it('are prefixed so a developer can tell what they name', () => {
    assert.match(newApplicationId(), /^app_[0-9a-f]{16}$/);
    assert.match(newRequestId(), /^req_[0-9a-f]{24}$/);
    assert.equal(prefixedId('cus', '66f0a1b2c3d4e5f6a7b8c9d0'), 'cus_66f0a1b2c3d4e5f6a7b8c9d0');
    assert.equal(parsePrefixedId('cus', 'cus_66f0a1b2c3d4e5f6a7b8c9d0'), '66f0a1b2c3d4e5f6a7b8c9d0');
  });

  it('are refused when they are of the wrong kind or malformed', () => {
    assert.equal(parsePrefixedId('cus', 'pay_66f0a1b2c3d4e5f6a7b8c9d0'), null);
    assert.equal(parsePrefixedId('cus', 'cus_123'), null);
    assert.equal(parsePrefixedId('pay', '66f0a1b2c3d4e5f6a7b8c9d0'), null);
    assert.equal(parsePrefixedId('cus', { $ne: null }), null);
  });
});

describe('scopes', () => {
  it('cover every domain named in the design, read and write apart', () => {
    assert.deepEqual(
      SCOPES.map((item) => item.scope),
      ['products:read', 'products:write', 'inventory:read', 'inventory:write', 'customers:read', 'customers:write', 'orders:read', 'orders:write', 'payments:read', 'returns:read', 'returns:write', 'refunds:read', 'refunds:write', 'webhooks:manage'],
    );
  });

  it('can only be granted once an endpoint uses them', () => {
    assert.deepEqual(grantableScopes(), ['products:read', 'inventory:read', 'inventory:write', 'customers:read', 'orders:read', 'orders:write', 'payments:read', 'returns:read', 'returns:write', 'refunds:read']);
    assert.deepEqual(refusedScopes(['orders:read', 'orders:write', 'payments:read']), []);
    assert.deepEqual(refusedScopes(['orders:read', 'products:write', 'refunds:write', 'webhooks:manage', 'admin', 7]), ['products:write', 'refunds:write', 'webhooks:manage', 'admin', '7']);
  });
});

describe('pagination', () => {
  it('uses 25 by default and never more than 100', () => {
    assert.equal(pageSize(undefined), 25);
    assert.equal(pageSize('abc'), 25);
    assert.equal(pageSize(0), 25);
    assert.equal(pageSize(-5), 25);
    assert.equal(pageSize(1), 1);
    assert.equal(pageSize('50'), 50);
    assert.equal(pageSize(100), 100);
    assert.equal(pageSize(5000), 100);
    assert.equal(pageSize(12.9), 12);
  });

  it('round-trips a cursor and refuses anything it did not issue', () => {
    const id = '66f0a1b2c3d4e5f6a7b8c9d0';

    assert.equal(decodeCursor(encodeCursor(id)), id);
    assert.notEqual(encodeCursor(id), id);
    assert.equal(decodeCursor(''), null);
    assert.equal(decodeCursor(undefined), null);
    assert.equal(decodeCursor('not-a-cursor'), null);
    assert.equal(decodeCursor(Buffer.from('{"$gt":""}').toString('base64url')), null);
    assert.equal(decodeCursor({ $gt: '' }), null);
  });
});

describe('credential lifetime', () => {
  const from = new Date('2026-10-07T00:00:00.000Z');

  it('gives an end date only for the offered choices; 0 means no end date', () => {
    assert.equal(expiryDate(0, from), null);
    assert.equal(expiryDate(undefined, from), null);
    assert.equal(expiryDate(7, from), null);
    assert.equal(expiryDate(30, from)!.toISOString(), '2026-11-06T00:00:00.000Z');
    assert.equal(expiryDate('90', from)!.toISOString(), '2027-01-05T00:00:00.000Z');
    assert.equal(expiryDate(365, from)!.toISOString(), '2027-10-07T00:00:00.000Z');
  });

  it('keeps a replaced key alive only for the offered grace periods; 0 stops it at once', () => {
    assert.equal(graceEnd(0, from), null);
    assert.equal(graceEnd(5, from), null);
    assert.equal(graceEnd(1, from)!.toISOString(), '2026-10-07T01:00:00.000Z');
    assert.equal(graceEnd(24, from)!.toISOString(), '2026-10-08T00:00:00.000Z');
    assert.equal(graceEnd(168, from)!.toISOString(), '2026-10-14T00:00:00.000Z');
  });
});

describe('usage days and logged paths', () => {
  it('counts a day as it is in Bangladesh, six hours ahead of UTC', () => {
    assert.equal(dhakaDay(new Date('2026-10-06T17:59:59Z')), '2026-10-06');
    assert.equal(dhakaDay(new Date('2026-10-06T18:00:00Z')), '2026-10-07');
    assert.deepEqual(recentDays(3, new Date('2026-10-07T06:00:00Z')), ['2026-10-05', '2026-10-06', '2026-10-07']);
    assert.equal(recentDays(7).length, 7);
    assert.equal(recentDays(7).at(-1), dhakaDay());
  });

  it('logs a path without its query string, so no phone number or email is kept', () => {
    assert.equal(loggedPath('/api/v1/developer/customers?phone=01711000001&email=a@b.c'), '/api/v1/developer/customers');
    assert.equal(loggedPath('/api/v1/developer/orders/SGO-0001001'), '/api/v1/developer/orders/SGO-0001001');
    assert.equal(loggedPath(undefined), '');
    assert.equal(loggedPath('/' + 'x'.repeat(500)).length, 200);
  });

  it('marks which scopes can change data', () => {
    assert.deepEqual(SCOPES.filter((item) => item.access === 'write').map((item) => item.scope), ['products:write', 'inventory:write', 'customers:write', 'orders:write', 'returns:write', 'refunds:write', 'webhooks:manage']);
    assert.deepEqual(SCOPES.filter((item) => item.available && item.access === 'write').map((item) => item.scope), ['inventory:write', 'orders:write', 'returns:write'], 'the writes that have endpoints today');
  });
});

describe('idempotency keys', () => {
  it('must be present and 8 to 255 printable characters without spaces', () => {
    assert.equal(idempotencyKeyProblem(undefined), 'missing');
    assert.equal(idempotencyKeyProblem(''), 'missing');
    assert.equal(idempotencyKeyProblem('4f8f6a0e-0d0c-4b56-9d3e-7b1f0c9a2e11'), '');
    assert.equal(idempotencyKeyProblem('order-SGO-0001001-cancel'), '');
    assert.equal(idempotencyKeyProblem('short'), 'invalid');
    assert.equal(idempotencyKeyProblem('has a space in it'), 'invalid');
    assert.equal(idempotencyKeyProblem('x'.repeat(256)), 'invalid');
    assert.equal(idempotencyKeyProblem('x'.repeat(255)), '');
    assert.equal(idempotencyKeyProblem(['a-list-of-keys']), 'invalid');
    assert.equal(idempotencyKeyProblem('ক্যানসেল-অর্ডার'), 'invalid');
  });

  it('a request is the same request whatever the order of its fields, and a different one otherwise', () => {
    const base = requestFingerprint('POST', '/api/v1/developer/returns', { order_id: 'SGO-0001001', items: [{ sku: 'A', quantity: 1 }], reason: 'wrong_size' });

    assert.equal(base.length, 64);
    assert.equal(requestFingerprint('post', '/api/v1/developer/returns', { reason: 'wrong_size', items: [{ quantity: 1, sku: 'A' }], order_id: 'SGO-0001001' }), base);
    assert.notEqual(requestFingerprint('POST', '/api/v1/developer/returns', { order_id: 'SGO-0001001', items: [{ sku: 'A', quantity: 2 }], reason: 'wrong_size' }), base);
    assert.notEqual(requestFingerprint('POST', '/api/v1/developer/orders/SGO-0001001/cancel', { order_id: 'SGO-0001001', items: [{ sku: 'A', quantity: 1 }], reason: 'wrong_size' }), base);
    // the order of a list does matter: it is part of what was asked
    assert.notEqual(requestFingerprint('POST', '/x', { items: ['a', 'b'] }), requestFingerprint('POST', '/x', { items: ['b', 'a'] }));
    assert.equal(requestFingerprint('POST', '/x', undefined), requestFingerprint('POST', '/x', null));
  });
});
