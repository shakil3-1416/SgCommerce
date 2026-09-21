import Link from 'next/link';

import {
  ProductCard,
} from '@/components/product-card';

import {
  getProducts,
} from '@/lib/api';

import type { Product } from '@/lib/types';

export default async function Home() {
  let products: Product[] = [];

  try {
    const result =
      await getProducts();

    products =
      result.items.slice(0, 6);
  } catch {
    products = [];
  }

  return (
    <main>
      <section className="bg-[#1f1235] text-white">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-purple-200">
              SgCommerce
            </p>

            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Shop products you&apos;ll actually want.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-zinc-400">
              Browse products, choose variants,
              check availability and order through
              our modern commerce experience.
            </p>

            <div className="mt-10">
              <Link
                href="/products"
                className="inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-[#1f1235] transition hover:bg-zinc-200"
              >
                Browse products
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-9 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#38205f]">
              Catalog
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Featured products
            </h2>
          </div>

          <Link
            href="/products"
            className="text-sm font-semibold text-[#38205f] hover:text-[#1f1235]"
          >
            View all products
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <h3 className="font-semibold">
              Products will appear here.
            </h3>

            <p className="mt-2 text-sm text-zinc-500">
              The storefront is waiting for catalog data from the API.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
