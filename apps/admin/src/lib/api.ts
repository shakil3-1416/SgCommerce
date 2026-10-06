import {
  cookies,
} from 'next/headers';

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

async function adminFetch(
  path: string,
) {
  const store =
    await cookies();

  const token =
    store.get(
      'sg_admin_token',
    )?.value;

  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        cache: 'no-store',

        headers: token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {},
      },
    );

  if (!response.ok) {
    throw new Error(
      `Admin API failed: ${response.status}`,
    );
  }

  return response.json();
}

export async function getProducts() {
  return adminFetch(
    '/products?limit=100',
  );
}

export async function getOrders() {
  return adminFetch(
    '/orders',
  );
}

export async function getInventory() {
  return adminFetch(
    '/inventory?limit=100',
  );
}

export async function getCustomers() {
  return adminFetch(
    '/customers',
  );
}

export async function getReturns() {
  return adminFetch(
    '/returns',
  );
}

export async function getRefunds() {
  return adminFetch(
    '/refunds',
  );
}

/*
 * The Developers section: API applications, what they asked for, and
 * the API's reference.
 */

/** The address outside programs call: the API's public address with /developer added. */
export function developerApiUrl(): string {
  const api =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    'http://localhost:4000/api/v1';

  return `${api.replace(/\/+$/, '')}/developer`;
}

export async function getDeveloperOverview() {
  return adminFetch(
    '/developer-applications',
  );
}

export async function getDeveloperApplication(
  appId: string,
) {
  return adminFetch(
    `/developer-applications/${encodeURIComponent(appId)}`,
  );
}

export async function getDeveloperRequests(
  query: URLSearchParams,
) {
  const text = query.toString();

  return adminFetch(
    `/developer-applications/requests${text ? `?${text}` : ''}`,
  );
}

export async function getDeveloperReference() {
  return adminFetch(
    '/developer-applications/reference',
  );
}
