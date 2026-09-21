import type {
  Inventory,
  Product,
  ProductListResponse,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

async function apiFetch<T>(
  path: string,
): Promise<T> {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(
      `SgCommerce API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getProducts(
  query?: string,
): Promise<ProductListResponse> {
  const params = new URLSearchParams();

  params.set('active', 'true');
  params.set('limit', '100');

  if (query?.trim()) {
    params.set('q', query.trim());
  }

  return apiFetch<ProductListResponse>(
    `/products?${params.toString()}`,
  );
}

export async function getProduct(
  slug: string,
): Promise<Product> {
  return apiFetch<Product>(
    `/products/${encodeURIComponent(slug)}`,
  );
}

export async function getInventory(
  sku: string,
): Promise<Inventory | null> {
  try {
    return await apiFetch<Inventory>(
      `/inventory/${encodeURIComponent(sku)}`,
    );
  } catch {
    return null;
  }
}
