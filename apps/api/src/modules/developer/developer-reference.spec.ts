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

/* The routes the controller really declares, read from its source: scope and path of every @Get. */
function controllerRoutes(): Array<{ path: string; scope: string | null }> {
  const source = readFileSync(join(__dirname, 'developer.controller.ts'), 'utf8');
  const routes: Array<{ path: string; scope: string | null }> = [];
  let scope: string | null = null;

  for (const line of source.split('\n')) {
    const required = /@RequireScope\('([^']+)'\)/.exec(line);
    const get = /@Get\((?:'([^']*)')?\)/.exec(line);

    if (required) {
      scope = required[1] ?? null;
    }

    if (get) {
      const path = get[1] ? `/${get[1].replace(/:([A-Za-z]+)/g, '{$1}')}` : '';

      routes.push({ path, scope });
      scope = null;
    }
  }

  return routes;
}

describe('the reference', () => {
  it('lists exactly the routes the controller declares, with the same scopes', () => {
    const declared = controllerRoutes().map((route) => `${route.path} [${route.scope ?? 'any key'}]`).sort();
    const documented = REFERENCE_ENDPOINTS.map((endpoint) => `${endpoint.path} [${endpoint.scope ?? 'any key'}]`).sort();

    assert.ok(declared.length >= 18, 'the controller source was read');
    assert.deepEqual(documented, declared);
  });

  it('names only scopes that exist and can be granted', () => {
    const grantable = new Set(SCOPES.filter((item) => item.available).map((item) => item.scope));

    for (const endpoint of REFERENCE_ENDPOINTS) {
      assert.ok(endpoint.scope === null || grantable.has(endpoint.scope), `${endpoint.path}: ${endpoint.scope}`);
    }
  });

  it('has a summary for every endpoint and no duplicate paths or error codes', () => {
    assert.equal(new Set(REFERENCE_ENDPOINTS.map((endpoint) => endpoint.path)).size, REFERENCE_ENDPOINTS.length);
    assert.equal(new Set(REFERENCE_ERRORS.map((error) => error.code)).size, REFERENCE_ERRORS.length);
    assert.ok(REFERENCE_ENDPOINTS.every((endpoint) => endpoint.summary.length > 5));
  });

  it('gives the admin page everything in one answer, as a copy that cannot change the source', () => {
    const reference = developerReference();

    assert.deepEqual(reference.rateLimit, { requests: 240, perSeconds: 60 });
    assert.deepEqual(reference.pagination, { defaultLimit: 25, maximumLimit: 100 });
    assert.equal(reference.endpoints.length, REFERENCE_ENDPOINTS.length);
    assert.equal(reference.scopes.length, 14);

    reference.endpoints[0]!.filters.push('changed');
    assert.deepEqual(REFERENCE_ENDPOINTS[0]!.filters, []);
  });
});
