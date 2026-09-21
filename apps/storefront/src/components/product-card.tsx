import Link from 'next/link';

import type {
  Product,
} from '@/lib/types';

function money(value: number) {
  return new Intl.NumberFormat(
    'en-BD',
    {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function ProductCard({
  product,
}: {
  product: Product;
}) {
  const prices =
    product.variants
      .filter((variant) => variant.active)
      .map((variant) => variant.price);

  const minimumPrice =
    prices.length > 0
      ? Math.min(...prices)
      : 0;

  const category =
    typeof product.category === 'string'
      ? ''
      : product.category.name;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-6xl font-bold text-zinc-300">
            {product.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {category || product.brand || 'Product'}
          </span>

          {product.brand && (
            <span className="text-xs text-zinc-400">
              {product.brand}
            </span>
          )}
        </div>

        <h2 className="text-lg font-semibold text-[#1f1235] group-hover:text-[#38205f]">
          {product.name}
        </h2>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
          {product.description}
        </p>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">
              From
            </p>

            <p className="text-lg font-bold text-[#1f1235]">
              {money(minimumPrice)}
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
