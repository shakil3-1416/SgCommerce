import type {
  Metadata,
} from 'next';

import Link from 'next/link';

import {
  notFound,
} from 'next/navigation';

import {
  ProductCard,
} from '@/components/product-card';

import {
  ProductImageGallery,
} from '@/components/product-image-gallery';

import {
  ProductPurchasePanel,
} from '@/components/product-purchase-panel';

import {
  getInventory,
  getProduct,
  getProducts,
} from '@/lib/api';

import type {
  Inventory,
  Product,
} from '@/lib/types';

type Params =
  Promise<{
    slug: string;
  }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const {
    slug,
  } =
    await params;

  try {
    const product =
      await getProduct(
        slug,
      );

    return {
      title:
        product.name,
      description:
        product.description,
    };
  } catch {
    return {
      title:
        'Product',
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
  } =
    await params;

  let product:
    Product;

  try {
    product =
      await getProduct(
        slug,
      );
  } catch {
    notFound();
  }

  const stockResults =
    await Promise.all(
      product.variants.map(
        async (
          variant,
        ) => ({
          sku:
            variant.sku,

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

  let relatedProducts:
    Product[] = [];

  if (
    category
  ) {
    try {
      const related =
        await getProducts({
          category:
            category.slug,
          limit: 8,
          page: 1,
          sort: 'newest',
        });

      relatedProducts =
        related.items
          .filter(
            (item) =>
              item._id !==
              product._id,
          )
          .slice(
            0,
            4,
          );
    } catch {
      relatedProducts =
        [];
    }
  }

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
          <ProductImageGallery
            images={
              product.images ??
              []
            }
            name={
              product.name
            }
          />
        </section>

        <section>
          <div className="flex flex-wrap gap-2">
            {category && (
              <span className="rounded-full bg-[#f2edf8] px-3 py-1 text-xs font-semibold text-[#38205f]">
                {
                  category.name
                }
              </span>
            )}

            {product.brand && (
              <span className="rounded-full border border-[#e8e2ef] bg-white px-3 py-1 text-xs font-semibold text-[#6f6679]">
                {
                  product.brand
                }
              </span>
            )}
          </div>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#1f1235] lg:text-5xl">
            {
              product.name
            }
          </h1>

          <p className="mt-6 leading-8 text-[#6f6679]">
            {
              product.description
            }
          </p>

          <ProductPurchasePanel
            product={
              product
            }
            inventoryBySku={
              inventoryBySku
            }
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e8e2ef] bg-white p-5">
              <p className="font-bold text-[#1f1235]">
                Delivery
              </p>

              <p className="mt-2 text-sm leading-6 text-[#6f6679]">
                Delivery availability and timing are confirmed during checkout.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e8e2ef] bg-white p-5">
              <p className="font-bold text-[#1f1235]">
                Returns
              </p>

              <p className="mt-2 text-sm leading-6 text-[#6f6679]">
                Eligible orders can request a return from the SgCommerce returns page.
              </p>
            </div>
          </div>
        </section>
      </div>

      {relatedProducts.length >
        0 && (
        <section className="mt-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#38205f]">
                You may also like
              </p>

              <h2 className="mt-2 text-3xl font-bold text-[#1f1235]">
                Related products
              </h2>
            </div>

            {category && (
              <Link
                href={`/products?category=${encodeURIComponent(
                  category.slug,
                )}`}
                className="text-sm font-semibold text-[#38205f]"
              >
                View category
              </Link>
            )}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            {relatedProducts.map(
              (
                related,
              ) => (
                <ProductCard
                  key={
                    related._id
                  }
                  product={
                    related
                  }
                />
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}
