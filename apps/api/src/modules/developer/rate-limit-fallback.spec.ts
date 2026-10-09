/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/developer/rate-limit-fallback.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWindowLimiter, whenSharedLimiterDown } from './rate-limit-fallback';

describe('whenSharedLimiterDown', () => {
  it('refuses writes and degrades reads to the local window', () => {
    assert.deepEqual(whenSharedLimiterDown(true), { kind: 'refuse', retryAfter: 30 });
    assert.deepEqual(whenSharedLimiterDown(false), { kind: 'local' });
  });
});

describe('LocalWindowLimiter', () => {
  it('allows the allowance, then refuses until the window ends', () => {
    let now = 0;
    const limiter = new LocalWindowLimiter(100, () => now);
    for (let i = 0; i < 3; i += 1) assert.equal(limiter.hit('app', 3, 60).allowed, true);
    const refused = limiter.hit('app', 3, 60);
    assert.equal(refused.allowed, false);
    assert.equal(refused.remaining, 0);
    assert.equal(refused.retryAfter, 60);
    now = 59_000;
    assert.equal(limiter.hit('app', 3, 60).retryAfter, 1);
    now = 60_000;
    assert.equal(limiter.hit('app', 3, 60).allowed, true);
  });

  it('keeps applications apart', () => {
    const limiter = new LocalWindowLimiter(100, () => 0);
    assert.equal(limiter.hit('a', 1, 60).allowed, true);
    assert.equal(limiter.hit('a', 1, 60).allowed, false);
    assert.equal(limiter.hit('b', 1, 60).allowed, true);
  });

  it('stays bounded in memory', () => {
    let now = 0;
    const limiter = new LocalWindowLimiter(10, () => now);
    for (let i = 0; i < 50; i += 1) limiter.hit(`app-${i}`, 5, 60);
    assert.ok(limiter.size <= 10);
    now = 61_000;
    limiter.hit('fresh', 5, 60);
    assert.equal(limiter.size, 1);
  });
});
