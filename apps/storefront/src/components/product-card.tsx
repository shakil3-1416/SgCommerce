import Link from 'next/link';

import {
  ProductImage,
} from '@/components/product-image';

import {
  QuickAddProduct,
} from '@/components/quick-add-product';

import type {
  Product,
} from '@/lib/types';

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    'en-BD',
    {
      style:
        'currency',

      currency:
        'BDT',

      maximumFractionDigits:
        0,
    },
  ).format(
    value,
  );
}

export function ProductCard({
  product,
}: {
  product:
    Product;
}) {
  const variants =
    product.variants.filter(
      (
        variant,
      ) =>
        variant.active,
    );

  const minimumPrice =
    variants.length >
    0
      ? Math.min(
          ...variants.map(
            (
              variant,
            ) =>
              variant.price,
          ),
        )
      : 0;

  const category =
    typeof product.category ===
    'string'
      ? ''
      : product.category.name;

  const hasPriceRange =
    new Set(
      variants.map(
        (
          variant,
        ) =>
          variant.price,
      ),
    ).size > 1;

  return (
    <article
      data-product-card={
        product.slug
      }
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      <Link
        href={`/products/${product.slug}`}
        aria-label={`View ${product.name}`}
        className="block"
      >
        <div className="aspect-square overflow-hidden bg-[#f7f4fa]">
          <ProductImage
            src={
              product
                .images?.[0]
            }
            alt={
              product.name
            }
            fallbackText={
              product.name
            }
            className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs font-bold uppercase tracking-[0.12em] text-[#6f6679]">
            {category ||
              'Product'}
          </span>

          {product.brand && (
            <span className="max-w-[45%] truncate text-xs font-medium text-[#8a8193]">
              {
                product.brand
              }
            </span>
          )}
        </div>

        <Link
          href={`/products/${product.slug}`}
          className="mt-3"
        >
          <h2 className="line-clamp-2 min-h-14 text-lg font-bold leading-7 text-[#1f1235] transition group-hover:text-[#4c2a7d]">
            {
              product.name
            }
          </h2>
        </Link>

        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#6f6679]">
          {
            product.description
          }
        </p>

        <div className="mt-4">
          <p className="text-xs font-medium text-[#8a8193]">
            {hasPriceRange
              ? 'From'
              : 'Price'}
          </p>

          <p className="mt-1 text-xl font-bold text-[#1f1235]">
            {
              money(
                minimumPrice,
              )
            }
          </p>
        </div>

        <div className="mt-auto pt-5">
          <QuickAddProduct
            product={
              product
            }
          />

          <Link
            href={`/products/${product.slug}`}
            className="mt-2 flex w-full items-center justify-center rounded-xl border border-[#ddd4e8] px-4 py-2.5 text-sm font-semibold text-[#38205f] transition hover:bg-[#f7f4fa]"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
