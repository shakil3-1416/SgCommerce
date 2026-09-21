'use client';

import Link from 'next/link';

import {
  useCart,
} from '@/components/cart-provider';

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

export default function CartPage() {
  const {
    items,
    subtotal,
    updateQuantity,
    removeItem,
  } = useCart();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4c2a7d]">
          Shopping bag
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#1f1235]">
          Your cart
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-[#e8e2ef] bg-[#faf8fc] p-12 text-center">
          <h2 className="text-xl font-bold text-[#1f1235]">
            Your cart is empty
          </h2>

          <p className="mt-2 text-[#6f6679]">
            Add something from the catalog to get started.
          </p>

          <Link
            href="/products"
            className="mt-6 inline-flex rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white hover:bg-[#38205f]"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {items.map(
              (item) => (
                <article
                  key={item.sku}
                  className="rounded-2xl border border-[#e8e2ef] bg-white p-5"
                >
                  <div className="flex justify-between gap-5">
                    <div>
                      <Link
                        href={`/products/${item.productSlug}`}
                        className="text-lg font-bold text-[#1f1235] hover:text-[#4c2a7d]"
                      >
                        {item.productName}
                      </Link>

                      <p className="mt-1 text-sm text-[#6f6679]">
                        {item.variantTitle}
                      </p>

                      <p className="mt-1 text-xs text-[#8a8092]">
                        SKU {item.sku}
                      </p>
                    </div>

                    <p className="font-bold text-[#1f1235]">
                      {money(
                        item.price *
                          item.quantity,
                      )}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="inline-flex items-center overflow-hidden rounded-xl border border-[#e8e2ef]">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.sku,
                            item.quantity -
                              1,
                          )
                        }
                        className="h-10 w-10 bg-[#faf8fc] font-bold text-[#1f1235]"
                      >
                        −
                      </button>

                      <span className="flex h-10 min-w-12 items-center justify-center font-semibold">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        disabled={
                          item.quantity >=
                          item.available
                        }
                        onClick={() =>
                          updateQuantity(
                            item.sku,
                            item.quantity +
                              1,
                          )
                        }
                        className="h-10 w-10 bg-[#faf8fc] font-bold text-[#1f1235] disabled:text-[#c5bccb]"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeItem(
                          item.sku,
                        )
                      }
                      className="text-sm font-semibold text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ),
            )}
          </section>

          <aside className="h-fit rounded-3xl bg-[#1f1235] p-7 text-white">
            <h2 className="text-xl font-bold">
              Order summary
            </h2>

            <div className="mt-6 flex justify-between text-purple-100">
              <span>Subtotal</span>

              <span>
                {money(
                  subtotal,
                )}
              </span>
            </div>

            <div className="mt-5 border-t border-white/20 pt-5">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>

                <span>
                  {money(
                    subtotal,
                  )}
                </span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-7 block w-full rounded-xl bg-white px-6 py-3.5 text-center font-bold text-[#1f1235] hover:bg-purple-50"
            >
              Continue to checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
