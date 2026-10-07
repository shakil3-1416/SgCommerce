/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/developer/developer-reference.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { SCOPES } from './developer-api';
import { developerReference, REFERENCE_ENDPOINTS, REFERENCE_ERRORS } from './developer-reference';

/* The routes the two controllers really declare, read from their source: method, scope and path. */
function controllerRoutes(): Array<{ method: string; path: string; scope: string | null }> {
  const routes: Array<{ method: string; path: string; scope: string | null }> = [];

  for (const file of ['developer.controller.ts', 'developer-write.controller.ts']) {
    const source = readFileSync(join(__dirname, file), 'utf8');
    let scope: string | null = null;

    for (const line of source.split('\n')) {
      const required = /@RequireScope\('([^']+)'\)/.exec(line);
      const route = /@(Get|Post|Patch|Delete)\((?:'([^']*)')?\)/.exec(line);

      if (required) {
        scope = required[1] ?? null;
      }

      if (route) {
        const path = route[2] ? `/${route[2].replace(/:([A-Za-z]+)/g, '{$1}')}` : '';

        routes.push({ method: route[1]!.toUpperCase(), path, scope });
        scope = null;
      }
    }
  }

  return routes;
}

describe('the reference', () => {
  it('lists exactly the routes the controller declares, with the same scopes', () => {
    const declared = controllerRoutes().map((route) => `${route.method} ${route.path} [${route.scope ?? 'any key'}]`).sort();
    const documented = REFERENCE_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path} [${endpoint.scope ?? 'any key'}]`).sort();

    assert.ok(declared.length >= 31, 'the controller sources were read');
    assert.deepEqual(documented, declared);
  });

  it('names only scopes that exist and can be granted', () => {
    const grantable = new Set(SCOPES.filter((item) => item.available).map((item) => item.scope));

    for (const endpoint of REFERENCE_ENDPOINTS) {
      assert.ok(endpoint.scope === null || grantable.has(endpoint.scope), `${endpoint.path}: ${endpoint.scope}`);
    }
  });

  it('has a summary for every endpoint and no duplicate paths or error codes', () => {
    assert.equal(new Set(REFERENCE_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size, REFERENCE_ENDPOINTS.length);
    assert.equal(new Set(REFERENCE_ERRORS.map((error) => error.code)).size, REFERENCE_ERRORS.length);
    assert.ok(REFERENCE_ENDPOINTS.every((endpoint) => endpoint.summary.length > 5));
  });

  it('gives the admin page everything in one answer, as a copy that cannot change the source', () => {
    const reference = developerReference();

    assert.deepEqual(reference.rateLimit, { requests: 240, writes: 60, perSeconds: 60 });
    assert.deepEqual(reference.idempotency, { header: 'Idempotency-Key', rememberedForHours: 24 });
    assert.deepEqual(reference.pagination, { defaultLimit: 25, maximumLimit: 100 });
    assert.equal(reference.endpoints.length, REFERENCE_ENDPOINTS.length);
    assert.equal(reference.scopes.length, 14);

    reference.endpoints[0]!.filters.push('changed');
    assert.deepEqual(REFERENCE_ENDPOINTS[0]!.filters, []);
  });

  it('every write needs a write scope and says what its body takes; no read has a body', () => {
    const writes = REFERENCE_ENDPOINTS.filter((endpoint) => endpoint.method !== 'GET');

    assert.deepEqual(writes.map((endpoint) => `${endpoint.method} ${endpoint.path}`).sort(), [
      'DELETE /customers/{customerId}/addresses/{addressId}',
      'PATCH /customers/{customerId}',
      'PATCH /products/{productId}',
      'PATCH /products/{productId}/variants/{sku}',
      'POST /customers/{customerId}/addresses',
      'POST /inventory/{sku}/adjustments',
      'POST /orders/{orderNumber}/cancel',
      'POST /orders/{orderNumber}/status',
      'POST /products',
      'POST /products/{productId}/variants',
      'POST /refunds/{refundNumber}/status',
      'POST /returns',
      'POST /returns/{returnNumber}/status',
    ]);
    assert.ok(writes.every((endpoint) => endpoint.scope?.endsWith(':write')));
    assert.ok(writes.filter((endpoint) => endpoint.method !== 'DELETE').every((endpoint) => (endpoint.body ?? []).length > 0));
    assert.ok(REFERENCE_ENDPOINTS.filter((endpoint) => endpoint.method === 'GET').every((endpoint) => endpoint.body === undefined && !endpoint.scope?.endsWith(':write')));
  });
});
