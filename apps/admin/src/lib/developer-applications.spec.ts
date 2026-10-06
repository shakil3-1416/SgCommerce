/**
 * Run with (tsx is installed in the api workspace):
 *   pnpm --filter api exec tsx --test ../admin/src/lib/developer-applications.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applicationState,
  barHeights,
  createProblem,
  errorRate,
  eventLabel,
  expiryChoiceLabel,
  firstRequest,
  graceChoiceLabel,
  groupScopes,
  lastUsedLabel,
  requestsLink,
  scopeChanges,
  snippets,
  statusTone,
} from './developer-applications';

const when = (value: unknown) => (value ? '7 Oct 2026, 02:00' : '');
const application = { id: 'app_1', name: 'CRM', environment: 'live', keyHint: 'sg_live_3f9a\u2026c41d', scopes: ['orders:read'], status: 'active' };
const scope = (name: string, group: string) => ({ scope: name, group, access: 'read' as const, allows: 'x', available: true });
const day = (requests: number, errors = 0) => ({ day: '2026-10-07', requests, errors });

describe('groupScopes', () => {
  it('keeps scopes under their group, in the order given', () => {
    const groups = groupScopes([scope('products:read', 'Catalog'), scope('orders:read', 'Orders'), scope('products:write', 'Catalog')]);

    assert.deepEqual(groups.map((g) => [g.group, g.scopes.map((s) => s.scope)]), [['Catalog', ['products:read', 'products:write']], ['Orders', ['orders:read']]]);
    assert.deepEqual(groupScopes([]), []);
  });
});

describe('createProblem', () => {
  it('asks for a name, a description that fits, and at least one permission', () => {
    assert.match(createProblem('', ['orders:read']), /Give the application a name/);
    assert.match(createProblem(' x ', ['orders:read']), /Give the application a name/);
    assert.match(createProblem('x'.repeat(81), ['orders:read']), /80 characters or fewer/);
    assert.match(createProblem('Warehouse ERP', ['orders:read'], 'd'.repeat(301)), /300 characters or fewer/);
    assert.match(createProblem('Warehouse ERP', []), /at least one permission/);
    assert.equal(createProblem('Warehouse ERP', ['orders:read'], 'Pathao sync'), '');
  });
});

describe('applicationState', () => {
  const now = new Date('2026-10-07T00:00:00Z');

  it('flags a key that has expired or will within two weeks', () => {
    assert.deepEqual(applicationState(application, now), { label: 'Active', tone: 'good' });
    assert.deepEqual(applicationState({ ...application, expiresAt: '2027-01-01T00:00:00Z' }, now), { label: 'Active', tone: 'good' });
    assert.deepEqual(applicationState({ ...application, expiresAt: '2026-10-17T00:00:00Z' }, now), { label: 'Key expires in 10 days', tone: 'warning' });
    assert.deepEqual(applicationState({ ...application, expiresAt: '2026-10-07T05:00:00Z' }, now), { label: 'Key expires in 1 day', tone: 'warning' });
    assert.deepEqual(applicationState({ ...application, expiresAt: '2026-10-06T00:00:00Z' }, now), { label: 'Key expired', tone: 'bad' });
    assert.deepEqual(applicationState({ ...application, status: 'revoked', expiresAt: '2026-10-06T00:00:00Z' }, now), { label: 'Revoked', tone: 'muted' });
  });
});

describe('choices', () => {
  it('are worded for a person', () => {
    assert.deepEqual([0, 30, 90, 365].map(expiryChoiceLabel), ['Never expires', 'Expires in 30 days', 'Expires in 90 days', 'Expires in 1 year']);
    assert.deepEqual([0, 1, 24, 168].map(graceChoiceLabel), ['Stop the old key now', 'Keep the old key working for 1 hour', 'Keep the old key working for 1 day', 'Keep the old key working for 7 days']);
  });
});

describe('scopeChanges', () => {
  it('says what is added and what is taken away', () => {
    assert.deepEqual(scopeChanges(['orders:read', 'customers:read'], ['orders:read', 'payments:read']), { added: ['payments:read'], removed: ['customers:read'] });
    assert.deepEqual(scopeChanges(['orders:read'], ['orders:read']), { added: [], removed: [] });
  });
});

describe('usage', () => {
  it('shows the share of requests that failed', () => {
    assert.equal(errorRate(undefined), '0%');
    assert.equal(errorRate({ weekRequests: 0, weekErrors: 0 }), '0%');
    assert.equal(errorRate({ weekRequests: 200, weekErrors: 0 }), '0%');
    assert.equal(errorRate({ weekRequests: 1000, weekErrors: 3 }), '<1%');
    assert.equal(errorRate({ weekRequests: 200, weekErrors: 30 }), '15%');
    assert.equal(errorRate({ weekRequests: 5, weekErrors: 5 }), '100%');
  });

  it('scales bars to the busiest day and keeps a small day visible', () => {
    assert.deepEqual(barHeights([day(0), day(50), day(100), day(1)]), [0, 50, 100, 4]);
    assert.deepEqual(barHeights([day(0), day(0)]), [0, 0]);
    assert.deepEqual(barHeights([]), []);
  });

  it('colours a request by its status', () => {
    assert.deepEqual([200, 204, 401, 404, 429, 500, 503].map(statusTone), ['good', 'good', 'warning', 'warning', 'warning', 'bad', 'bad']);
  });
});

describe('history', () => {
  it('names each kind of change', () => {
    assert.deepEqual(['created', 'updated', 'scopes_changed', 'key_rolled', 'revoked', 'something_new'].map(eventLabel), ['Created', 'Updated', 'Permissions changed', 'Key replaced', 'Revoked', 'something_new']);
  });
});

describe('snippets and links', () => {
  it('shows a first request that can be pasted into a terminal', () => {
    assert.equal(firstRequest('https://api.example.com/api/v1/developer', 'sg_live_abc'), 'curl -H "Authorization: Bearer sg_live_abc" https://api.example.com/api/v1/developer');
  });

  it('offers the same request in curl, JavaScript and Python, never with a real key by default', () => {
    const all = snippets('https://api.example.com/api/v1/developer');

    assert.deepEqual(all.map((item) => item.language), ['curl', 'JavaScript', 'Python']);
    assert.ok(all.every((item) => item.code.includes('https://api.example.com/api/v1/developer/orders')));
    assert.ok(all.every((item) => item.code.includes('sg_live_your_key')));
    assert.ok(all[1]!.code.includes('Authorization: "Bearer sg_live_your_key"'));
  });

  it('builds the address of a filtered request log', () => {
    assert.equal(requestsLink({}), '/developers/requests');
    assert.equal(requestsLink({ appId: 'app_1' }), '/developers/requests?app_id=app_1');
    assert.equal(requestsLink({ appId: 'app_1', status: '4xx', requestId: 'req_a b', cursor: 'abc' }), '/developers/requests?app_id=app_1&status=4xx&request_id=req_a+b&cursor=abc');
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
