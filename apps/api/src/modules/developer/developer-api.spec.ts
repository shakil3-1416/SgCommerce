/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/developer/developer-api.spec.ts
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  currentEnvironment,
  decodeCursor,
  encodeCursor,
  generateApiKey,
  grantableScopes,
  hashApiKey,
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
    assert.deepEqual(grantableScopes(), ['products:read', 'inventory:read', 'customers:read', 'orders:read', 'payments:read', 'returns:read', 'refunds:read']);
    assert.deepEqual(refusedScopes(['orders:read', 'payments:read']), []);
    assert.deepEqual(refusedScopes(['orders:read', 'orders:write', 'admin', 7]), ['orders:write', 'admin', '7']);
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
