import type {
  Category,
  Inventory,
  Product,
  ProductListResponse,
} from './types';

const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

async function apiFetch<T>(
  path: string,
): Promise<T> {
  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        cache: 'no-store',
      },
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `SgCommerce API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (
    response.json() as Promise<T>
  );
}

export type ProductSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc';

export interface ProductQuery {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?:
    | string
    | number;
  maxPrice?:
    | string
    | number;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

function addParam(
  params: URLSearchParams,
  key: string,
  value:
    | string
    | number
    | undefined,
) {
  if (
    value === undefined
  ) {
    return;
  }

  const normalized =
    String(value).trim();

  if (
    normalized
  ) {
    params.set(
      key,
      normalized,
    );
  }
}

export async function getProducts(
  query?:
    | string
    | ProductQuery,
): Promise<ProductListResponse> {
  const params =
    new URLSearchParams();

  params.set(
    'active',
    'true',
  );

  if (
    typeof query ===
    'string'
  ) {
    params.set(
      'limit',
      '24',
    );

    if (
      query.trim()
    ) {
      params.set(
        'q',
        query.trim(),
      );
    }
  } else {
    params.set(
      'limit',
      String(
        query?.limit ??
        24,
      ),
    );

    params.set(
      'page',
      String(
        query?.page ??
        1,
      ),
    );

    addParam(
      params,
      'q',
      query?.q,
    );

    addParam(
      params,
      'category',
      query?.category,
    );

    addParam(
      params,
      'brand',
      query?.brand,
    );

    addParam(
      params,
      'minPrice',
      query?.minPrice,
    );

    addParam(
      params,
      'maxPrice',
      query?.maxPrice,
    );

    addParam(
      params,
      'sort',
      query?.sort,
    );
  }

  return apiFetch<ProductListResponse>(
    `/products?${params.toString()}`,
  );
}

export async function getCategories():
  Promise<Category[]> {
  return apiFetch<Category[]>(
    '/categories',
  );
}

export async function getProduct(
  slug: string,
): Promise<Product> {
  return apiFetch<Product>(
    `/products/${encodeURIComponent(
      slug,
    )}`,
  );
}

export async function getInventory(
  sku: string,
): Promise<Inventory | null> {
  try {
    return await apiFetch<Inventory>(
      `/inventory/${encodeURIComponent(
        sku,
      )}`,
    );
  } catch {
    return null;
  }
}
