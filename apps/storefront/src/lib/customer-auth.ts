/*
 * Previous SgCommerce builds stored a bearer token under
 * this key. Current builds never store authentication
 * credentials in Web Storage.
 *
 * Keep the key only long enough to remove old browser data
 * from customers upgrading from an earlier release.
 */
const LEGACY_CUSTOMER_TOKEN_KEY =
  'sgcommerce-customer-token';

export function clearLegacyCustomerToken() {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  window.localStorage.removeItem(
    LEGACY_CUSTOMER_TOKEN_KEY,
  );
}

export async function customerFetch(
  path: string,
  init?: RequestInit,
) {
  if (
    !path.startsWith('/')
  ) {
    throw new Error(
      'Customer API path must start with "/"',
    );
  }

  clearLegacyCustomerToken();

  const headers =
    new Headers(
      init?.headers,
    );

  if (
    init?.body &&
    !headers.has(
      'Content-Type',
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  return fetch(
    `/api/customer/backend${path}`,
    {
      ...init,
      headers,
      cache: 'no-store',
      credentials:
        'same-origin',
    },
  );
}

export async function logoutCustomer() {
  clearLegacyCustomerToken();

  return fetch(
    '/api/customer/session',
    {
      method: 'DELETE',
      cache: 'no-store',
      credentials:
        'same-origin',
    },
  );
}
