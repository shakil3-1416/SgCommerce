'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  useCart,
} from '@/components/cart-provider';

import {
  DELIVERY_FEE,
  deliveryZoneFor,
  DISTRICTS,
  matchDistrict,
  ZONE_LABEL,
} from '@/lib/districts';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

const CHECKOUT_IDEMPOTENCY_KEY =
  'sgcommerce-checkout-idempotency-key';

interface SavedAddress {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  area?: string;
  postalCode?: string;

  zone:
    | 'inside_dhaka'
    | 'outside_dhaka';

  isDefault: boolean;
}

interface AccountData {
  customer: {
    name: string;
    phone: string;
    email: string;
    addresses:
      SavedAddress[];
  };
}

interface CheckoutForm {
  name: string;
  phone: string;
  email: string;

  addressLine1:
    string;

  addressLine2:
    string;

  /* The district, chosen from a list. The delivery zone follows from it. */
  city: string;
  area: string;

  postalCode:
    string;
}

const EMPTY_FORM:
  CheckoutForm = {
    name: '',
    phone: '',
    email: '',

    addressLine1:
      '',

    addressLine2:
      '',

    city: '',
    area: '',

    postalCode:
      '',
  };

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

export default function CheckoutPage() {
  const {
    items,
    subtotal,
    clearCart,
  } =
    useCart();

  const router =
    useRouter();

  const [
    form,
    setForm,
  ] =
    useState<CheckoutForm>(
      {
        ...EMPTY_FORM,
      },
    );

  const [
    authenticated,
    setAuthenticated,
  ] =
    useState(false);

  const [
    profileLoading,
    setProfileLoading,
  ] =
    useState(true);

  const [
    profileMessage,
    setProfileMessage,
  ] =
    useState('');

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

  /*
   * The delivery charge follows from the district. Until one is chosen
   * there is no charge to show, and the total is the subtotal.
   */
  const districtChosen =
    form.city !== '';

  const deliveryZone =
    deliveryZoneFor(form.city);

  const shippingFee =
    DELIVERY_FEE[deliveryZone];

  const total =
    subtotal +
    (districtChosen
      ? shippingFee
      : 0);

  /*
   * Load the signed-in customer once.
   *
   * A 401 simply means this is a guest checkout.
   * A signed-in customer receives automatic prefill.
   */
  useEffect(
    () => {
      let active =
        true;

      async function loadCustomer() {
        try {
          const response =
            await fetch(
              '/api/customer/backend/auth/me',
              {
                cache:
                  'no-store',
              },
            );

          if (
            response.status ===
              401 ||
            response.status ===
              403
          ) {
            if (active) {
              setAuthenticated(
                false,
              );
            }

            return;
          }

          if (
            !response.ok
          ) {
            throw new Error(
              'Unable to load saved customer details',
            );
          }

          const body =
            (
              await response.json()
            ) as
              AccountData;

          const customer =
            body.customer;

          const defaultAddress =
            customer.addresses
              ?.find(
                (
                  address,
                ) =>
                  address.isDefault,
              ) ??
            customer.addresses
              ?.[0];

          if (!active) {
            return;
          }

          setAuthenticated(
            true,
          );

          setForm(
            (
              current,
            ) => ({
              ...current,

              name:
                customer.name ??
                '',

              phone:
                customer.phone ??
                '',

              email:
                customer.email ??
                '',

              addressLine1:
                defaultAddress
                  ?.addressLine1 ??
                '',

              addressLine2:
                defaultAddress
                  ?.addressLine2 ??
                '',

              /*
               * Saved addresses hold free text. It is matched to a
               * district; when nothing matches, the customer chooses.
               */
              city:
                matchDistrict(
                  defaultAddress
                    ?.city,
                ),

              area:
                defaultAddress
                  ?.area ??
                '',

              postalCode:
                defaultAddress
                  ?.postalCode ??
                '',
            }),
          );

          if (
            defaultAddress
          ) {
            setProfileMessage(
              'Your account and default delivery address were filled automatically. You can edit anything below for this order.',
            );
          } else {
            setProfileMessage(
              'Your account details were filled automatically. Add a delivery address below. You can edit any field for this order.',
            );
          }
        } catch (
          cause
        ) {
          if (!active) {
            return;
          }

          setProfileMessage(
            cause instanceof
              Error
              ? cause.message
              : 'Unable to load saved customer details',
          );
        } finally {
          if (active) {
            setProfileLoading(
              false,
            );
          }
        }
      }

      void loadCustomer();

      return () => {
        active =
          false;
      };
    },
    [],
  );

  function updateField<
    K extends
      keyof CheckoutForm
  >(
    key: K,
    value:
      CheckoutForm[K],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [key]:
          value,
      }),
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      items.length ===
      0 ||
      submitting ||
      profileLoading
    ) {
      return;
    }

    setSubmitting(
      true,
    );

    setError(
      '',
    );

    const payload = {
      customer: {
        name:
          form.name.trim(),

        phone:
          form.phone.trim(),

        email:
          form.email
            .trim() ||
          undefined,
      },

      shippingAddress: {
        addressLine1:
          form.addressLine1
            .trim(),

        addressLine2:
          form.addressLine2
            .trim() ||
          undefined,

        city:
          form.city.trim(),

        area:
          form.area
            .trim() ||
          undefined,

        postalCode:
          form.postalCode
            .trim() ||
          undefined,

        /* Sent for information only; the API works it out again. */
        zone:
          deliveryZone,
      },

      items:
        items.map(
          (
            item,
          ) => ({
            sku:
              item.sku,

            quantity:
              item.quantity,
          }),
        ),
    };

    try {
      let idempotencyKey =
        window.localStorage
          .getItem(
            CHECKOUT_IDEMPOTENCY_KEY,
          );

      if (
        !idempotencyKey
      ) {
        idempotencyKey =
          window.crypto
            .randomUUID();

        window.localStorage
          .setItem(
            CHECKOUT_IDEMPOTENCY_KEY,
            idempotencyKey,
          );
      }

      /*
       * Signed-in customers use the same-origin BFF.
       * The JWT remains HttpOnly and the API receives
       * the authenticated customerId.
       *
       * Guests retain the existing public checkout.
       */
      const endpoint =
        authenticated
          ? '/api/customer/checkout'
          : `${API_URL}/orders`;

      const response =
        await fetch(
          endpoint,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              'x-idempotency-key':
                idempotencyKey,
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      let body:
        Record<
          string,
          any
        > = {};

      try {
        body =
          await response
            .json();
      } catch {
        body = {};
      }

      if (
        response.status ===
          401 &&
        authenticated
      ) {
        throw new Error(
          'Your session expired. Please sign in again before placing the order.',
        );
      }

      if (
        !response.ok
      ) {
        const message =
          Array.isArray(
            body.message,
          )
            ? body.message
                .join(', ')
            : body.message;

        throw new Error(
          typeof message ===
            'string'
            ? message
            : 'Unable to place order',
        );
      }

      if (
        !body.orderNumber
      ) {
        throw new Error(
          'Order was created without an order number',
        );
      }

      window.localStorage
        .removeItem(
          CHECKOUT_IDEMPOTENCY_KEY,
        );

      clearCart();

      router.push(
        `/order-confirmation/${encodeURIComponent(
          String(
            body.orderNumber,
          ),
        )}`,
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Unable to place order',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  if (
    items.length ===
    0
  ) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <section className="rounded-3xl border border-[#e8e2ef] bg-white p-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
            Checkout
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#1f1235]">
            Your cart is empty
          </h1>

          <p className="mt-3 text-[#6f6679]">
            Add something to your cart before checking out.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-block rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white"
          >
            Start shopping
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
          Secure checkout
        </p>

        <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
          Complete your order
        </h1>

        <p className="mt-3 max-w-2xl text-[#6f6679]">
          {profileLoading
            ? 'Loading your saved account details...'
            : authenticated
              ? 'Your saved information is ready. Edit any field if this order needs different contact or delivery details.'
              : 'Checking out as a guest. Sign in first if you want this order saved automatically in My Orders.'}
        </p>
      </div>

      {profileMessage && (
        <div className="mb-6 rounded-2xl border border-[#ddd4e8] bg-[#f7f2fb] px-5 py-4 text-sm text-[#4c2a7d]">
          {profileMessage}
        </div>
      )}

      <form
        onSubmit={
          submit
        }
        className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"
      >
        <div className="space-y-8">
          <section className="rounded-3xl border border-[#e8e2ef] bg-white p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#1f1235]">
                  Customer details
                </h2>

                <p className="mt-1 text-sm text-[#6f6679]">
                  {authenticated
                    ? 'Loaded from your account. Changes here apply to this order.'
                    : 'Tell us who this order is for.'}
                </p>
              </div>

              {authenticated && (
                <span className="rounded-full bg-[#f2edf8] px-3 py-1.5 text-xs font-bold text-[#4c2a7d]">
                  Account connected
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Full name
                </span>

                <input
                  required
                  name="name"
                  autoComplete="name"
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'name',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-[#1f1235]">
                  Phone
                </span>

                <input
                  required
                  name="phone"
                  autoComplete="tel"
                  value={
                    form.phone
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'phone',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-[#1f1235]">
                  Email
                </span>

                <span className="ml-2 text-xs font-normal text-[#8a8193]">
                  Optional
                </span>

                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'email',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e8e2ef] bg-white p-7">
            <div>
              <h2 className="text-xl font-bold text-[#1f1235]">
                Delivery address
              </h2>

              <p className="mt-1 text-sm text-[#6f6679]">
                {authenticated
                  ? 'Your default saved address is used when available. You can edit it for this order.'
                  : 'Enter the address where the order should be delivered.'}
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Address
                </span>

                <input
                  required
                  minLength={
                    3
                  }
                  name="addressLine1"
                  autoComplete="address-line1"
                  value={
                    form.addressLine1
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'addressLine1',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-[#1f1235]">
                  Apartment, suite or landmark
                </span>

                <span className="ml-2 text-xs font-normal text-[#8a8193]">
                  Optional
                </span>

                <input
                  name="addressLine2"
                  autoComplete="address-line2"
                  value={
                    form.addressLine2
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'addressLine2',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-[#1f1235]">
                  District
                </span>

                <select
                  required
                  name="city"
                  autoComplete="address-level2"
                  value={
                    form.city
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'city',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] bg-white px-4 py-3 outline-none focus:border-[#38205f]"
                >
                  <option value="">
                    Choose your district
                  </option>

                  {DISTRICTS.map(
                    (district) => (
                      <option
                        key={district}
                        value={district}
                      >
                        {district}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-[#1f1235]">
                  Area
                </span>

                <input
                  name="area"
                  value={
                    form.area
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'area',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-[#1f1235]">
                  Postal code
                </span>

                <span className="ml-2 text-xs font-normal text-[#8a8193]">
                  Optional
                </span>

                <input
                  name="postalCode"
                  autoComplete="postal-code"
                  value={
                    form.postalCode
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'postalCode',
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-[#ddd4e8] px-4 py-3 outline-none focus:border-[#38205f]"
                />
              </label>

              {/*
                * The customer no longer picks the zone. It follows from
                * the district, here and again on the server.
                */}
              <div
                aria-live="polite"
                className="self-end rounded-xl bg-[#f7f4fa] px-4 py-3 text-sm text-[#4f455c]"
              >
                {districtChosen ? (
                  <>
                    <span className="font-semibold text-[#1f1235]">
                      {ZONE_LABEL[deliveryZone]}
                    </span>
                    {' delivery: '}
                    {money(shippingFee)}
                  </>
                ) : (
                  'Choose your district to see the delivery charge.'
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-3xl bg-[#1f1235] p-7 text-white lg:sticky lg:top-28">
          <h2 className="text-xl font-bold">
            Order summary
          </h2>

          <div className="mt-6 space-y-4">
            {items.map(
              (
                item,
              ) => (
                <div
                  key={
                    item.sku
                  }
                  className="flex justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">
                      {
                        item.productName
                      }{' '}
                      ×{' '}
                      {
                        item.quantity
                      }
                    </p>

                    <p className="mt-1 text-xs text-purple-200">
                      {
                        item.variantTitle
                      }
                    </p>
                  </div>

                  <span className="shrink-0">
                    {money(
                      item.price *
                        item.quantity,
                    )}
                  </span>
                </div>
              ),
            )}
          </div>

          <div className="mt-6 border-t border-white/20 pt-5">
            <div className="flex justify-between text-purple-100">
              <span>
                Subtotal
              </span>

              <span>
                {money(
                  subtotal,
                )}
              </span>
            </div>

            <div className="mt-4 flex justify-between text-purple-100">
              <span>
                Delivery
              </span>

              <span>
                {districtChosen
                  ? money(
                      shippingFee,
                    )
                  : 'Choose district'}
              </span>
            </div>

            <div className="mt-5 flex justify-between border-t border-white/20 pt-5 text-lg font-bold">
              <span>
                Total
              </span>

              <span>
                {money(
                  total,
                )}
              </span>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              profileLoading
            }
            className="mt-7 w-full rounded-xl bg-white px-6 py-3.5 font-bold text-[#1f1235] transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {profileLoading
              ? 'Loading your details...'
              : submitting
                ? 'Placing order...'
                : 'Place order'}
          </button>

          {authenticated ? (
            <p className="mt-4 text-center text-xs leading-5 text-purple-200">
              This order will appear automatically in My Orders.
            </p>
          ) : (
            <p className="mt-4 text-center text-xs leading-5 text-purple-200">
              Want automatic order history?{' '}
              <Link
                href="/login"
                className="font-bold text-white underline"
              >
                Sign in
              </Link>{' '}
              before placing the order.
            </p>
          )}
        </aside>
      </form>
    </main>
  );
}
