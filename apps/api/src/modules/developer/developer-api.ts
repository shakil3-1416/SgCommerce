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
  allows: string;
  /**
   * False while no endpoint uses the scope yet. Such a scope cannot be
   * granted, so a credential never gains a power later that nobody
   * chose to give it.
   */
  available: boolean;
}

export const SCOPES: readonly ScopeDefinition[] = [
  { scope: 'products:read', group: 'Catalog', allows: 'Read products, variants and categories', available: true },
  { scope: 'products:write', group: 'Catalog', allows: 'Create and update products', available: false },
  { scope: 'inventory:read', group: 'Inventory', allows: 'Read stock levels and stock movements', available: true },
  { scope: 'inventory:write', group: 'Inventory', allows: 'Change stock', available: false },
  { scope: 'customers:read', group: 'Customers', allows: 'Read customers and their addresses', available: true },
  { scope: 'customers:write', group: 'Customers', allows: 'Update customer profiles', available: false },
  { scope: 'orders:read', group: 'Orders', allows: 'Read orders, their lines and history', available: true },
  { scope: 'orders:write', group: 'Orders', allows: 'Cancel orders and change their status', available: false },
  { scope: 'payments:read', group: 'Payments', allows: 'Read the state of payments', available: true },
  { scope: 'returns:read', group: 'Returns', allows: 'Read returns', available: true },
  { scope: 'returns:write', group: 'Returns', allows: 'Create and manage returns', available: false },
  { scope: 'refunds:read', group: 'Refunds', allows: 'Read the state of refunds', available: true },
  { scope: 'refunds:write', group: 'Refunds', allows: 'Refund operations', available: false },
  { scope: 'webhooks:manage', group: 'Platform', allows: 'Configure webhook subscriptions', available: false },
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

/** Requests one application may make per minute. */
export const READ_RATE_LIMIT = 240;
export const RATE_WINDOW_SECONDS = 60;
