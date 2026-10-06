import {
  DEVELOPER_API_VERSION,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  RATE_WINDOW_SECONDS,
  READ_RATE_LIMIT,
  SCOPES,
} from './developer-api';

/*
 * The Developer API described as data: every endpoint, what it needs and
 * what it accepts. The admin's reference page is drawn from this, and
 * developer-reference.spec.ts checks it against the controller, so the
 * documentation cannot quietly drift from what the API really does.
 */

export interface ReferenceEndpoint {
  group: string;
  method: 'GET';
  /** Relative to the Developer API's base address. */
  path: string;
  /** The scope a key needs; null when any valid key may call it. */
  scope: string | null;
  summary: string;
  /** Query parameters, apart from `limit` and `cursor` on collections. */
  filters: string[];
  /** True when the answer is a paged collection. */
  paged: boolean;
}

export const REFERENCE_ENDPOINTS: ReferenceEndpoint[] = [
  { group: 'Application', method: 'GET', path: '', scope: null, summary: 'The application the key belongs to, its scopes and the rate limit. The first call to make.', filters: [], paged: false },

  { group: 'Catalog', method: 'GET', path: '/products', scope: 'products:read', summary: 'List products.', filters: ['q', 'category', 'brand', 'active'], paged: true },
  { group: 'Catalog', method: 'GET', path: '/products/{productId}', scope: 'products:read', summary: 'One product, by product code (SGP-000217).', filters: [], paged: false },
  { group: 'Catalog', method: 'GET', path: '/categories', scope: 'products:read', summary: 'All categories.', filters: [], paged: false },

  { group: 'Inventory', method: 'GET', path: '/inventory', scope: 'inventory:read', summary: 'List stock levels.', filters: ['sku', 'low_stock'], paged: true },
  { group: 'Inventory', method: 'GET', path: '/inventory/{sku}', scope: 'inventory:read', summary: 'Stock of one SKU: on hand, reserved, available.', filters: [], paged: false },
  { group: 'Inventory', method: 'GET', path: '/inventory/{sku}/movements', scope: 'inventory:read', summary: 'Every change to a SKU\'s stock, newest first.', filters: [], paged: true },

  { group: 'Customers', method: 'GET', path: '/customers', scope: 'customers:read', summary: 'List customers.', filters: ['phone', 'email'], paged: true },
  { group: 'Customers', method: 'GET', path: '/customers/{customerId}', scope: 'customers:read', summary: 'One customer with saved addresses.', filters: [], paged: false },
  { group: 'Customers', method: 'GET', path: '/customers/{customerId}/orders', scope: 'orders:read', summary: 'The orders of one customer.', filters: [], paged: true },

  { group: 'Orders', method: 'GET', path: '/orders', scope: 'orders:read', summary: 'List orders.', filters: ['status', 'payment_status', 'customer_id', 'phone', 'created_after', 'created_before'], paged: true },
  { group: 'Orders', method: 'GET', path: '/orders/{orderNumber}', scope: 'orders:read', summary: 'One order with its lines, address and history.', filters: [], paged: false },

  { group: 'Payments', method: 'GET', path: '/payments', scope: 'payments:read', summary: 'List online payments.', filters: ['order_id', 'status'], paged: true },
  { group: 'Payments', method: 'GET', path: '/payments/{paymentId}', scope: 'payments:read', summary: 'One payment.', filters: [], paged: false },

  { group: 'Returns', method: 'GET', path: '/returns', scope: 'returns:read', summary: 'List returns.', filters: ['order_id', 'status'], paged: true },
  { group: 'Returns', method: 'GET', path: '/returns/{returnNumber}', scope: 'returns:read', summary: 'One return with its items.', filters: [], paged: false },

  { group: 'Refunds', method: 'GET', path: '/refunds', scope: 'refunds:read', summary: 'List refunds.', filters: ['order_id', 'return_id', 'status'], paged: true },
  { group: 'Refunds', method: 'GET', path: '/refunds/{refundNumber}', scope: 'refunds:read', summary: 'One refund.', filters: [], paged: false },
];

export interface ReferenceError {
  status: number;
  code: string;
  meaning: string;
}

export const REFERENCE_ERRORS: ReferenceError[] = [
  { status: 400, code: 'invalid_cursor', meaning: 'The cursor was not issued by this API.' },
  { status: 400, code: 'invalid_request', meaning: 'The request could not be understood.' },
  { status: 401, code: 'authentication_required', meaning: 'No key was sent.' },
  { status: 401, code: 'invalid_credential', meaning: 'The key is not valid.' },
  { status: 401, code: 'credential_revoked', meaning: 'The application was revoked.' },
  { status: 401, code: 'credential_expired', meaning: 'The key has passed its end date.' },
  { status: 401, code: 'credential_replaced', meaning: 'The key was replaced and its grace period is over.' },
  { status: 401, code: 'credential_environment_mismatch', meaning: 'A test key on the live API, or the reverse.' },
  { status: 403, code: 'insufficient_scope', meaning: 'The key lacks the scope named in details.required_scope.' },
  { status: 404, code: '{resource}_not_found', meaning: 'No such record: product, category, inventory, customer, order, payment, return or refund.' },
  { status: 422, code: 'validation_failed', meaning: 'A parameter is not valid; details lists what.' },
  { status: 429, code: 'rate_limit_exceeded', meaning: 'Too many requests; wait for the time in Retry-After.' },
  { status: 500, code: 'internal_error', meaning: 'A fault on our side; report the request id.' },
];

/** Everything the admin's reference page shows. */
export function developerReference() {
  return {
    version: DEVELOPER_API_VERSION,
    authentication: { header: 'Authorization', scheme: 'Bearer', prefixes: { live: 'sg_live_', test: 'sg_test_' } },
    rateLimit: { requests: READ_RATE_LIMIT, perSeconds: RATE_WINDOW_SECONDS },
    pagination: { defaultLimit: DEFAULT_PAGE_SIZE, maximumLimit: MAX_PAGE_SIZE },
    scopes: SCOPES.map((item) => ({ ...item })),
    endpoints: REFERENCE_ENDPOINTS.map((endpoint) => ({ ...endpoint, filters: [...endpoint.filters] })),
    errors: REFERENCE_ERRORS.map((error) => ({ ...error })),
  };
}
