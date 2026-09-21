'use client';

import {
  FormEvent,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  useCart,
} from '@/components/cart-provider';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

const CHECKOUT_IDEMPOTENCY_KEY =
  'sgcommerce-checkout-idempotency-key';

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

export default function CheckoutPage() {
  const {
    items,
    subtotal,
    clearCart,
  } = useCart();

  const router =
    useRouter();

  const [
    zone,
    setZone,
  ] =
    useState(
      'inside_dhaka',
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const shippingFee =
    zone ===
      'inside_dhaka'
      ? 80
      : 150;

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      items.length === 0
    ) {
      return;
    }

    setSubmitting(true);
    setError('');

    const form =
      new FormData(
        event.currentTarget,
      );

    const payload = {
      customer: {
        name:
          String(
            form.get('name') ??
              '',
          ),

        phone:
          String(
            form.get('phone') ??
              '',
          ),

        email:
          String(
            form.get('email') ??
              '',
          ) ||
          undefined,
      },

      shippingAddress: {
        addressLine1:
          String(
            form.get(
              'addressLine1',
            ) ?? '',
          ),

        addressLine2:
          String(
            form.get(
              'addressLine2',
            ) ?? '',
          ) ||
          undefined,

        city:
          String(
            form.get('city') ??
              '',
          ),

        area:
          String(
            form.get('area') ??
              '',
          ) ||
          undefined,

        postalCode:
          String(
            form.get(
              'postalCode',
            ) ?? '',
          ) ||
          undefined,

        zone,
      },

      items:
        items.map(
          (item) => ({
            sku: item.sku,
            quantity:
              item.quantity,
          }),
        ),
    };

    try {
      let idempotencyKey =
        window.localStorage.getItem(
          CHECKOUT_IDEMPOTENCY_KEY,
        );

      if (!idempotencyKey) {
        idempotencyKey =
          window.crypto.randomUUID();

        window.localStorage.setItem(
          CHECKOUT_IDEMPOTENCY_KEY,
          idempotencyKey,
        );
      }

      const response =
        await fetch(
          `${API_URL}/orders`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'X-Idempotency-Key':
                idempotencyKey,
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body.message ??
            'Checkout failed',
        );
      }

      clearCart();

      window.localStorage.removeItem(
        CHECKOUT_IDEMPOTENCY_KEY,
      );

      router.push(
        `/order-confirmation/${body.orderNumber}`,
      );
    } catch (caught) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : 'Checkout failed',
      );

      setSubmitting(false);
    }
  }

  if (
    items.length === 0
  ) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-[#1f1235]">
          Your cart is empty
        </h1>

        <Link
          href="/products"
          className="mt-6 inline-flex rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white"
        >
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Checkout
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Complete your order
      </h1>

      <form
        onSubmit={submit}
        className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]"
      >
        <section className="space-y-8">
          <div className="rounded-3xl border border-[#e8e2ef] bg-white p-7">
            <h2 className="text-xl font-bold text-[#1f1235]">
              Customer details
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">
                  Full name
                </span>

                <input
                  required
                  name="name"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label>
                <span className="text-sm font-semibold">
                  Phone
                </span>

                <input
                  required
                  name="phone"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label>
                <span className="text-sm font-semibold">
                  Email
                </span>

                <input
                  type="email"
                  name="email"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-[#e8e2ef] bg-white p-7">
            <h2 className="text-xl font-bold text-[#1f1235]">
              Delivery address
            </h2>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">
                  Address
                </span>

                <input
                  required
                  name="addressLine1"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">
                  Apartment / landmark
                </span>

                <input
                  name="addressLine2"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label>
                <span className="text-sm font-semibold">
                  City
                </span>

                <input
                  required
                  name="city"
                  defaultValue="Dhaka"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label>
                <span className="text-sm font-semibold">
                  Area
                </span>

                <input
                  name="area"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label>
                <span className="text-sm font-semibold">
                  Postal code
                </span>

                <input
                  name="postalCode"
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
                />
              </label>

              <label>
                <span className="text-sm font-semibold">
                  Delivery zone
                </span>

                <select
                  value={zone}
                  onChange={(event) =>
                    setZone(
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
                >
                  <option value="inside_dhaka">
                    Inside Dhaka
                  </option>

                  <option value="outside_dhaka">
                    Outside Dhaka
                  </option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-[#e8e2ef] bg-[#faf8fc] p-7">
            <h2 className="font-bold text-[#1f1235]">
              Payment
            </h2>

            <p className="mt-2 text-sm text-[#6f6679]">
              Cash on Delivery is enabled for SgCommerce v1.
            </p>
          </div>
        </section>

        <aside className="h-fit rounded-3xl bg-[#1f1235] p-7 text-white">
          <h2 className="text-xl font-bold">
            Order summary
          </h2>

          <div className="mt-6 space-y-4">
            {items.map(
              (item) => (
                <div
                  key={item.sku}
                  className="flex justify-between gap-4 text-sm"
                >
                  <span className="text-purple-100">
                    {item.productName}
                    {' × '}
                    {item.quantity}
                  </span>

                  <span>
                    {money(
                      item.price *
                        item.quantity,
                    )}
                  </span>
                </div>
              ),
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-white/20 pt-5">
            <div className="flex justify-between text-purple-100">
              <span>Subtotal</span>
              <span>
                {money(subtotal)}
              </span>
            </div>

            <div className="flex justify-between text-purple-100">
              <span>Delivery</span>
              <span>
                {money(
                  shippingFee,
                )}
              </span>
            </div>

            <div className="flex justify-between pt-3 text-lg font-bold">
              <span>Total</span>

              <span>
                {money(
                  subtotal +
                    shippingFee,
                )}
              </span>
            </div>
          </div>

          {error && (
            <p className="mt-5 rounded-xl bg-red-500/20 p-3 text-sm text-red-100">
              {error}
            </p>
          )}

          <button
            disabled={submitting}
            className="mt-7 w-full rounded-xl bg-white px-6 py-3.5 font-bold text-[#1f1235] disabled:opacity-60"
          >
            {submitting
              ? 'Placing order...'
              : 'Place order'}
          </button>
        </aside>
      </form>
    </main>
  );
}
