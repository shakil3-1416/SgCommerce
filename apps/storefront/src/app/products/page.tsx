import type {
  Metadata,
} from 'next';

import {
  ProductCard,
} from '@/components/product-card';

import {
  getProducts,
} from '@/lib/api';

import type { Product } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Products',
};

type SearchParams = Promise<{
  q?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params =
    await searchParams;

  const query =
    params.q?.trim() ?? '';

  let products: Product[] = [];
  let total = 0;
  let error = false;

  try {
    const result =
      await getProducts(query);

    products = result.items;
    total = result.pagination.total;
  } catch {
    error = true;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#38205f]">
          Store
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          Products
        </h1>

        <p className="mt-3 text-zinc-600">
          Search the complete SgCommerce catalog.
        </p>
      </div>

      <form
        action="/products"
        method="get"
        className="mt-9 flex max-w-2xl gap-3"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products, brands or SKU..."
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none transition focus:border-zinc-950"
        />

        <button
          type="submit"
          className="rounded-xl bg-[#1f1235] px-6 py-3 font-semibold text-white hover:bg-[#38205f]"
        >
          Search
        </button>
      </form>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {error
            ? 'Unable to load products.'
            : query
              ? `${total} result${total === 1 ? '' : 's'} for "${query}"`
              : `${total} product${total === 1 ? '' : 's'}`}
        </p>

        {query && (
          <a
            href="/products"
            className="text-sm font-semibold text-[#38205f]"
          >
            Clear search
          </a>
        )}
      </div>

      {!error && products.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
            />
          ))}
        </div>
      )}

      {!error && products.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold">
            No products found
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Try another search.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          The product API could not be reached.
        </div>
      )}
    </main>
  );
}
