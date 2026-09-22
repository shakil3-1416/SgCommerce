import Link from 'next/link';

import {
  ProductImage,
} from '@/components/product-image';

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
  const prices =
    product.variants
      .filter(
        (
          variant,
        ) =>
          variant.active,
      )
      .map(
        (
          variant,
        ) =>
          variant.price,
      );

  const minimumPrice =
    prices.length >
    0
      ? Math.min(
          ...prices,
        )
      : 0;

  const category =
    typeof product.category ===
    'string'
      ? ''
      : product.category.name;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-2xl border border-[#e8e2ef] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#f2edf8]">
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
          className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="truncate text-xs font-medium uppercase tracking-wider text-[#6f6679]">
            {category ||
              'Product'}
          </span>

          {product.brand && (
            <span className="max-w-[45%] truncate text-xs text-[#6f6679]">
              {
                product.brand
              }
            </span>
          )}
        </div>

        <h2 className="line-clamp-2 min-h-14 text-lg font-semibold text-[#1f1235] group-hover:text-[#38205f]">
          {
            product.name
          }
        </h2>

        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#6f6679]">
          {
            product.description
          }
        </p>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-[#6f6679]">
              From
            </p>

            <p className="text-lg font-bold text-[#1f1235]">
              {money(
                minimumPrice,
              )}
            </p>
          </div>

          <span className="rounded-full bg-[#1f1235] px-4 py-2 text-sm font-medium text-white">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}
