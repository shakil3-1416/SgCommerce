import { createHash, randomBytes } from 'node:crypto';

/*
 * The Developer API: the parts that are plain data and arithmetic, kept
 * free of network and database code so they can be tested on their own.
 *
 * An outside program never signs in as a person. It is registered as an
 * application, gets its own credential and a list of scopes, and can be
 * switched off without touching anything else. The contract it sees lives
 * under /api/v1/developer and is separate from the endpoints the shop and
 * the admin use, so those can keep their shapes and this one can keep its
 * promises. See docs/DEVELOPER_API.md.
 */

export const DEVELOPER_API_VERSION = 'v1';

/* ------------------------------------------------------------------ */
/* Environments                                                        */
/* ------------------------------------------------------------------ */

export type ApiEnvironment = 'live' | 'test';

/**
 * A deployment is either the live shop or a sandbox with its own
 * database (API_ENVIRONMENT=test). Credentials carry the environment in
 * their prefix and only work where they were issued, so a test credential
 * can never change live commerce.
 */
export function currentEnvironment(): ApiEnvironment {
  return process.env.API_ENVIRONMENT === 'test' ? 'test' : 'live';
}

export const KEY_PREFIX: Record<ApiEnvironment, string> = {
  live: 'sg_live_',
  test: 'sg_test_',
};

/* ------------------------------------------------------------------ */
/* Scopes                                                              */
/* ------------------------------------------------------------------ */

export interface ScopeDefinition {
  scope: string;
  group: string;
  /** 'write' scopes can change the shop's data and deserve a second look. */
  access: 'read' | 'write';
  allows: string;
  /**
   * False while no endpoint uses the scope yet. Such a scope cannot be
   * granted, so a credential never gains a power later that nobody
   * chose to give it.
   */
  available: boolean;
}

export const SCOPES: readonly ScopeDefinition[] = [
  { scope: 'products:read', group: 'Catalog', access: 'read', allows: 'Read products, variants and categories', available: true },
  { scope: 'products:write', group: 'Catalog', access: 'write', allows: 'Create and update products', available: false },
  { scope: 'inventory:read', group: 'Inventory', access: 'read', allows: 'Read stock levels and stock movements', available: true },
  { scope: 'inventory:write', group: 'Inventory', access: 'write', allows: 'Change stock', available: true },
  { scope: 'customers:read', group: 'Customers', access: 'read', allows: 'Read customers and their addresses', available: true },
  { scope: 'customers:write', group: 'Customers', access: 'write', allows: 'Update customer profiles', available: false },
  { scope: 'orders:read', group: 'Orders', access: 'read', allows: 'Read orders, their lines and history', available: true },
  { scope: 'orders:write', group: 'Orders', access: 'write', allows: 'Cancel orders and change their status', available: true },
  { scope: 'payments:read', group: 'Payments', access: 'read', allows: 'Read the state of payments', available: true },
  { scope: 'returns:read', group: 'Returns', access: 'read', allows: 'Read returns', available: true },
  { scope: 'returns:write', group: 'Returns', access: 'write', allows: 'Create and manage returns', available: true },
  { scope: 'refunds:read', group: 'Refunds', access: 'read', allows: 'Read the state of refunds', available: true },
  { scope: 'refunds:write', group: 'Refunds', access: 'write', allows: 'Refund operations', available: false },
  { scope: 'webhooks:manage', group: 'Platform', access: 'write', allows: 'Configure webhook subscriptions', available: false },
];

const GRANTABLE = new Set(SCOPES.filter((item) => item.available).map((item) => item.scope));

export function grantableScopes(): string[] {
  return [...GRANTABLE];
}

/** The requested scopes that cannot be granted: unknown, or not available yet. */
export function refusedScopes(requested: readonly unknown[]): string[] {
  return requested
    .filter((scope) => typeof scope !== 'string' || !GRANTABLE.has(scope))
    .map((scope) => String(scope));
}

/* ------------------------------------------------------------------ */
/* Credentials and identifiers                                         */
/* ------------------------------------------------------------------ */

const KEY_PATTERN = /^sg_(live|test)_[0-9a-f]{40}$/;

/** A new credential: the environment prefix and 40 hex characters (160 random bits). */
export function generateApiKey(environment: ApiEnvironment): string {
  return `${KEY_PREFIX[environment]}${randomBytes(20).toString('hex')}`;
}

export function looksLikeApiKey(value: unknown): value is string {
  return typeof value === 'string' && KEY_PATTERN.test(value);
}

/** The environment a credential was issued for, read from its prefix. */
export function keyEnvironment(key: string): ApiEnvironment | null {
  const match = KEY_PATTERN.exec(key);

  return match ? (match[1] as ApiEnvironment) : null;
}

/**
 * Only this hash is stored. The credential itself is shown once, when it
 * is created, and cannot be recovered afterwards.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Enough of a credential to recognise it in a list: "sg_live_3f9a…c41d". */
export function keyHint(key: string): string {
  return `${key.slice(0, 12)}\u2026${key.slice(-4)}`;
}

export function newApplicationId(): string {
  return `app_${randomBytes(8).toString('hex')}`;
}

export function newRequestId(): string {
  return `req_${randomBytes(12).toString('hex')}`;
}

/** The credential in "Authorization: Bearer sg_live_…", or '' when there is none. */
export function readBearer(authorization: unknown): string {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;

  if (typeof header !== 'string' || !/^Bearer\s+/i.test(header)) {
    return '';
  }

  return header.replace(/^Bearer\s+/i, '').trim();
}

/* ------------------------------------------------------------------ */
/* Prefixed identifiers for records that have no business number       */
/* ------------------------------------------------------------------ */

const OBJECT_ID = /^[0-9a-f]{24}$/;

/** "cus_66f0…" for a customer, "pay_66f0…" for a payment. */
export function prefixedId(prefix: 'cus' | 'pay', id: unknown): string {
  return `${prefix}_${String(id)}`;
}

/** The database id inside a prefixed identifier, or null when it is not one. */
export function parsePrefixedId(prefix: 'cus' | 'pay', value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(`${prefix}_`)) {
    return null;
  }

  const id = value.slice(prefix.length + 1);

  return OBJECT_ID.test(id) ? id : null;
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function pageSize(limit: unknown): number {
  const value = Number(limit);

  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(value), MAX_PAGE_SIZE);
}

/** A cursor is opaque to the client. It holds the id of the last record of a page. */
export function encodeCursor(id: unknown): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}

/** The id inside a cursor, or null when the cursor is not one this API issued. */
export function decodeCursor(cursor: unknown): string | null {
  if (typeof cursor !== 'string' || cursor === '') {
    return null;
  }

  const id = Buffer.from(cursor, 'base64url').toString('utf8');

  return OBJECT_ID.test(id) ? id : null;
}

/* ------------------------------------------------------------------ */
/* Rate limits                                                         */
/* ------------------------------------------------------------------ */

/** Requests one application may make per minute: reads, and separately, writes. */
export const READ_RATE_LIMIT = 240;
export const WRITE_RATE_LIMIT = 60;
export const RATE_WINDOW_SECONDS = 60;

/* ------------------------------------------------------------------ */
/* Idempotency                                                         */
/* ------------------------------------------------------------------ */

/*
 * Every write carries an Idempotency-Key chosen by the caller. Sending
 * the same request again with the same key returns the first answer
 * instead of doing the thing twice: networks fail and programs retry,
 * and a retried "create return" must never create two returns.
 */

/** How long a key is remembered. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{8,255}$/;

/** Why a key cannot be used, or '' when it can. `key` is the header's value. */
export function idempotencyKeyProblem(key: unknown): string {
  if (key === undefined || key === null || key === '') {
    return 'missing';
  }

  return typeof key === 'string' && IDEMPOTENCY_KEY.test(key) ? '' : 'invalid';
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }

  return value;
}

/**
 * Identifies what a request asks for: method, path and body. The same
 * key with a different fingerprint is a mistake by the caller, not a
 * retry. The order of a body's fields does not matter.
 */
export function requestFingerprint(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify([method.toUpperCase(), path, canonical(body ?? null)]))
    .digest('hex');
}

/* ------------------------------------------------------------------ */
/* Credential lifetime                                                 */
/* ------------------------------------------------------------------ */

/**
 * How long a key may live, in days. 0 means it does not expire.
 * A key with an end date limits the damage of one that leaks unnoticed.
 */
export const EXPIRY_CHOICES = [0, 30, 90, 365] as const;

/**
 * When a key is replaced, how many hours the old key keeps working, so
 * the system using it can be switched over without an outage.
 * 0 stops the old key at once.
 */
export const ROLL_GRACE_CHOICES = [0, 1, 24, 168] as const;

export function expiryDate(days: unknown, from: Date = new Date()): Date | null {
  const value = Number(days);

  if (!(EXPIRY_CHOICES as readonly number[]).includes(value) || value === 0) {
    return null;
  }

  return new Date(from.getTime() + value * 24 * 60 * 60 * 1000);
}

export function graceEnd(hours: unknown, from: Date = new Date()): Date | null {
  const value = Number(hours);

  if (!(ROLL_GRACE_CHOICES as readonly number[]).includes(value) || value === 0) {
    return null;
  }

  return new Date(from.getTime() + value * 60 * 60 * 1000);
}

/* ------------------------------------------------------------------ */
/* Usage                                                               */
/* ------------------------------------------------------------------ */

const DHAKA_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Bangladesh, as "2026-10-07". Usage is counted per such day. */
export function dhakaDay(date: Date = new Date()): string {
  return DHAKA_DAY.format(date);
}

/** The last `count` days, oldest first, ending today. */
export function recentDays(count: number, today: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, index) =>
    dhakaDay(new Date(today.getTime() - (count - 1 - index) * 24 * 60 * 60 * 1000)),
  );
}

/** A path as it is logged: no query string, so no phone number or email ends up in the log. */
export function loggedPath(originalUrl: unknown): string {
  const path = String(originalUrl ?? '').split('?')[0] ?? '';

  return path.length > 200 ? path.slice(0, 200) : path;
}
