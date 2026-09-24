'use client';

import {
  useMemo,
  useState,
} from 'react';

import {
  useCart,
} from '@/components/cart-provider';

import type {
  Product,
} from '@/lib/types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

export function QuickAddProduct({
  product,
}: {
  product:
    Product;
}) {
  const {
    addItem,
  } = useCart();

  const variants =
    useMemo(
      () =>
        product.variants.filter(
          (
            variant,
          ) =>
            variant.active,
        ),
      [
        product,
      ],
    );

  const [
    selectedSku,
    setSelectedSku,
  ] =
    useState(
      variants[0]?.sku ??
        '',
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    feedback,
    setFeedback,
  ] =
    useState('');

  const [
    failed,
    setFailed,
  ] =
    useState(false);

  const variant =
    variants.find(
      (
        item,
      ) =>
        item.sku ===
        selectedSku,
    ) ??
    variants[0];

  async function add() {
    if (
      !variant ||
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );

    setFeedback(
      '',
    );

    setFailed(
      false,
    );

    try {
      const response =
        await fetch(
          `${API_URL}/inventory/${encodeURIComponent(
            variant.sku,
          )}`,
          {
            cache:
              'no-store',
          },
        );

      if (!response.ok) {
        throw new Error(
          'Unable to verify stock',
        );
      }

      const inventory =
        await response.json() as {
          available?:
            number;

          onHand?:
            number;

          reserved?:
            number;
        };

      const available =
        inventory.available ??
        (
          (
            inventory.onHand ??
            0
          ) -
          (
            inventory.reserved ??
            0
          )
        );

      if (
        available < 1
      ) {
        setFailed(
          true,
        );

        setFeedback(
          'Out of stock',
        );

        return;
      }

      const price =
        Number(
          variant.price,
        );

      if (
        !Number.isFinite(
          available,
        ) ||
        available <= 0
      ) {
        setFailed(true);
        setFeedback(
          'This item is currently out of stock',
        );
        return;
      }

      if (
        !Number.isFinite(
          price,
        ) ||
        price < 0
      ) {
        throw new Error(
          'Invalid product price',
        );
      }

      const payload = {
        sku:
          variant.sku,

        productId:
          product._id,

        productSlug:
          product.slug,

        productName:
          product.name,

        variantTitle:
          variant.title,

        price,

        available:
          Math.floor(
            available,
          ),

        image:
          product.images?.[0] ??
          '',

        quantity: 1,
      };

      addItem(
        payload,
      );

      setFeedback(
        'Added to cart',
      );
    } catch (
      cause
    ) {
      setFailed(
        true,
      );

      setFeedback(
        cause instanceof Error
          ? cause.message
          : 'Unable to add to cart',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    variants.length ===
    0
  ) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-xl bg-[#eeeaf3] px-4 py-3 text-sm font-semibold text-[#8a8193]"
      >
        Unavailable
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {variants.length >
        1 && (
        <label className="block">
          <span className="sr-only">
            Choose option for {
              product.name
            }
          </span>

          <select
            aria-label={`Choose option for ${product.name}`}
            value={
              selectedSku
            }
            onChange={(
              event,
            ) => {
              setSelectedSku(
                event.target
                  .value,
              );

              setFeedback(
                '',
              );

              setFailed(
                false,
              );
            }}
            className="w-full rounded-xl border border-[#ddd4e8] bg-white px-3 py-2.5 text-sm font-medium text-[#1f1235] outline-none transition focus:border-[#6b46a1]"
          >
            {variants.map(
              (
                item,
              ) => (
                <option
                  key={
                    item.sku
                  }
                  value={
                    item.sku
                  }
                >
                  {
                    item.title
                  }
                </option>
              ),
            )}
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={() =>
          void add()
        }
        disabled={
          busy
        }
        className="w-full rounded-xl bg-[#1f1235] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#38205f] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy
          ? 'Checking stock...'
          : feedback ===
              'Added to cart'
            ? 'Added'
            : 'Add to cart'}
      </button>

      {feedback && (
        <p
          role="status"
          className={`text-center text-xs font-semibold ${
            failed
              ? 'text-red-600'
              : 'text-green-700'
          }`}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
