/**
 * What the Developer API does when its shared (Redis) rate limiter cannot
 * be reached.
 *
 * Writes fail closed: an order or stock change is never let through
 * without a limit. Reads degrade to a per-instance window with the same
 * allowance, so one instance can never serve more than the published rate
 * for an application while Redis is down. Before this, both were allowed
 * without any limit.
 */

export interface WindowDecision {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/** Fixed-window counter kept in this process only. Bounded in size. */
export class LocalWindowLimiter {
  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(
    private readonly maxKeys = 10_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  hit(key: string, allowance: number, windowSeconds: number): WindowDecision {
    const current = this.now();
    const windowMs = windowSeconds * 1000;
    let window = this.windows.get(key);

    if (!window || current - window.startedAt >= windowMs) {
      this.evict(current, windowMs);
      window = { startedAt: current, count: 0 };
      this.windows.set(key, window);
    }

    window.count += 1;
    const retryAfter = Math.max(1, Math.ceil((window.startedAt + windowMs - current) / 1000));

    return {
      allowed: window.count <= allowance,
      remaining: Math.max(0, allowance - window.count),
      retryAfter,
    };
  }

  get size(): number {
    return this.windows.size;
  }

  private evict(current: number, windowMs: number): void {
    for (const [key, window] of this.windows) {
      if (current - window.startedAt >= windowMs) {
        this.windows.delete(key);
      }
    }
    // Still full of live windows: drop the oldest so memory stays bounded.
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }
}

export type LimiterDownPolicy = { kind: 'refuse'; retryAfter: number } | { kind: 'local' };

/** Writes are refused while the shared limiter is down; reads use the local window. */
export function whenSharedLimiterDown(write: boolean): LimiterDownPolicy {
  return write ? { kind: 'refuse', retryAfter: 30 } : { kind: 'local' };
}
