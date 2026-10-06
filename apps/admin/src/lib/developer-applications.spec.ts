/**
 * Run with (tsx is installed in the api workspace):
 *   pnpm --filter api exec tsx --test ../admin/src/lib/developer-applications.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createProblem, firstRequest, groupScopes, lastUsedLabel } from './developer-applications';

const when = (value: unknown) => (value ? '7 Oct 2026, 02:00' : '');
const application = { id: 'app_1', name: 'CRM', environment: 'live', keyHint: 'sg_live_3f9a\u2026c41d', scopes: ['orders:read'], status: 'active' };

describe('groupScopes', () => {
  it('keeps scopes under their group, in the order given', () => {
    const groups = groupScopes([
      { scope: 'products:read', group: 'Catalog', allows: 'a' },
      { scope: 'orders:read', group: 'Orders', allows: 'b' },
      { scope: 'products:write', group: 'Catalog', allows: 'c' },
    ]);

    assert.deepEqual(groups.map((g) => [g.group, g.scopes.map((s) => s.scope)]), [['Catalog', ['products:read', 'products:write']], ['Orders', ['orders:read']]]);
    assert.deepEqual(groupScopes([]), []);
  });
});

describe('createProblem', () => {
  it('asks for a name and at least one permission', () => {
    assert.match(createProblem('', ['orders:read']), /Give the application a name/);
    assert.match(createProblem(' x ', ['orders:read']), /Give the application a name/);
    assert.match(createProblem('x'.repeat(81), ['orders:read']), /80 characters or fewer/);
    assert.match(createProblem('Warehouse ERP', []), /at least one permission/);
    assert.equal(createProblem('Warehouse ERP', ['orders:read']), '');
  });
});

describe('firstRequest', () => {
  it('shows a request that can be pasted into a terminal', () => {
    assert.equal(firstRequest('https://api.example.com/api/v1/developer', 'sg_live_abc'), 'curl -H "Authorization: Bearer sg_live_abc" https://api.example.com/api/v1/developer');
  });
});

describe('lastUsedLabel', () => {
  it('says when an application was last used, never used, or revoked', () => {
    assert.equal(lastUsedLabel(application, when), 'Never used');
    assert.equal(lastUsedLabel({ ...application, lastUsedAt: '2026-10-06T20:00:00Z' }, when), 'Last used 7 Oct 2026, 02:00');
    assert.equal(lastUsedLabel({ ...application, status: 'revoked', revokedAt: '2026-10-06T20:00:00Z' }, when), 'Revoked 7 Oct 2026, 02:00');
    assert.equal(lastUsedLabel({ ...application, status: 'revoked' }, when), 'Revoked');
  });
});
