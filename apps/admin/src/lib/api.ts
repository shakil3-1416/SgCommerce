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
