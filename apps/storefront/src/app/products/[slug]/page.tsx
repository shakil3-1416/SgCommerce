import type {
  Metadata,
} from 'next';

import Link from 'next/link';

import {
  notFound,
} from 'next/navigation';

import {
  ProductPurchasePanel,
} from '@/components/product-purchase-panel';

import {
  getInventory,
  getProduct,
} from '@/lib/api';

import type {
  Inventory,
} from '@/lib/types';

type Params = Promise<{
  slug: string;
}>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const {
    slug,
  } = await params;

  try {
    const product =
      await getProduct(slug);

    return {
      title: product.name,
      description:
        product.description,
    };
  } catch {
    return {
      title: 'Product',
    };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Params;
}) {
  const {
    slug,
  } = await params;

  let product;

  try {
    product =
      await getProduct(slug);
  } catch {
    notFound();
  }

  const stockResults =
    await Promise.all(
      product.variants.map(
        async (variant) => ({
          sku: variant.sku,
          inventory:
            await getInventory(
              variant.sku,
            ),
        }),
      ),
    );

  const inventoryBySku:
    Record<
      string,
      Inventory | null
    > = {};

  for (
    const result
    of stockResults
  ) {
    inventoryBySku[
      result.sku
    ] =
      result.inventory;
  }

  const category =
    typeof product.category ===
    'string'
      ? null
      : product.category;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link
        href="/products"
        className="text-sm font-semibold text-[#6f6679] hover:text-[#1f1235]"
      >
        ← Back to products
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-2">
        <section>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-[#f2edf8]">
            {product.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  product.images[0]
                }
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-9xl font-bold text-[#d7cce2]">
                {product.name.charAt(
                  0,
                )}
              </span>
            )}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap gap-2">
            {category && (
              <span className="rounded-full bg-[#f2edf8] px-3 py-1 text-xs font-semibold text-[#38205f]">
                {category.name}
              </span>
            )}

            {product.brand && (
              <span className="rounded-full border border-[#e8e2ef] bg-white px-3 py-1 text-xs font-semibold text-[#6f6679]">
                {product.brand}
              </span>
            )}
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#1f1235] lg:text-5xl">
            {product.name}
          </h1>

          <p className="mt-6 leading-8 text-[#6f6679]">
            {product.description}
          </p>

          <ProductPurchasePanel
            product={product}
            inventoryBySku={
              inventoryBySku
            }
          />
        </section>
      </div>
    </main>
  );
}
