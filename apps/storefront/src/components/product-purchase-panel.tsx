'use client';

import {
  useMemo,
  useState,
} from 'react';

import {
  useCart,
} from './cart-provider';

import type {
  Inventory,
  Product,
} from '@/lib/types';

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    'en-BD',
    {
      style: 'currency',
      currency: 'BDT',
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function ProductPurchasePanel({
  product,
  inventoryBySku,
}: {
  product: Product;
  inventoryBySku:
    Record<
      string,
      Inventory | null
    >;
}) {
  const {
    addItem,
  } = useCart();

  const availableVariants =
    useMemo(
      () =>
        product.variants.filter(
          (variant) =>
            variant.active,
        ),
      [
        product.variants,
      ],
    );

  const defaultSku =
    availableVariants.find(
      (variant) =>
        (
          inventoryBySku[
            variant.sku
          ]?.available ?? 0
        ) > 0,
    )?.sku ??
    availableVariants[0]?.sku ??
    '';

  const [
    selectedSku,
    setSelectedSku,
  ] =
    useState(defaultSku);

  const [
    added,
    setAdded,
  ] =
    useState(false);

  const variant =
    availableVariants.find(
      (item) =>
        item.sku ===
        selectedSku,
    );

  if (!variant) {
    return (
      <p className="text-sm text-red-600">
        No active variants are available.
      </p>
    );
  }

  const selectedVariant = variant;

  const inventory =
    inventoryBySku[
      selectedVariant.sku
    ];

  const available =
    inventory?.available ?? 0;

  const inStock =
    available > 0;

  function handleAdd() {
    if (!inStock) {
      return;
    }

    addItem({
      sku: selectedVariant.sku,
      productId: product._id,
      productSlug:
        product.slug,
      productName:
        product.name,
      variantTitle:
        selectedVariant.title,
      price:
        selectedVariant.price,
      available,
    });

    setAdded(true);

    window.setTimeout(
      () => setAdded(false),
      1500,
    );
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-[#1f1235]">
        Choose a variant
      </h2>

      <div className="mt-4 space-y-3">
        {availableVariants.map(
          (item) => {
            const stock =
              inventoryBySku[
                item.sku
              ];

            const quantity =
              stock?.available ??
              0;

            const selected =
              selectedSku ===
              item.sku;

            return (
              <button
                key={item.sku}
                type="button"
                onClick={() =>
                  setSelectedSku(
                    item.sku,
                  )
                }
                className={`flex w-full items-center justify-between rounded-2xl border p-5 text-left ${
                  selected
                    ? 'border-[#29164a] bg-[#f2edf8] ring-1 ring-[#29164a]'
                    : 'border-[#e8e2ef] bg-white hover:border-[#4c2a7d]'
                }`}
              >
                <div>
                  <p className="font-semibold text-[#1f1235]">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs text-[#6f6679]">
                    SKU {item.sku}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-[#1f1235]">
                    {money(
                      item.price,
                    )}
                  </p>

                  <p
                    className={`mt-1 text-xs font-semibold ${
                      quantity > 0
                        ? stock?.lowStock
                          ? 'text-amber-600'
                          : 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {quantity > 0
                      ? stock?.lowStock
                        ? `Only ${quantity} left`
                        : `${quantity} available`
                      : 'Out of stock'}
                  </p>
                </div>
              </button>
            );
          },
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-[#e8e2ef] bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#6f6679]">
              Selected
            </p>

            <p className="mt-1 font-semibold text-[#1f1235]">
              {selectedVariant.title}
            </p>
          </div>

          <p className="text-2xl font-bold text-[#1f1235]">
            {money(
              selectedVariant.price,
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!inStock}
          className="mt-5 w-full rounded-xl bg-[#1f1235] px-6 py-3.5 font-bold text-white hover:bg-[#38205f] disabled:cursor-not-allowed disabled:bg-[#b8adbf]"
        >
          {added
            ? 'Added to cart'
            : inStock
              ? 'Add to cart'
              : 'Out of stock'}
        </button>
      </div>
    </div>
  );
}
