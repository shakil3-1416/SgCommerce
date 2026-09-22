'use client';

import Link from 'next/link';

import {
  useEffect,
  useState,
} from 'react';

import {
  clearCustomerToken,
  getCustomerToken,
} from '@/lib/customer-auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface OrderItem {
  productSlug: string;
  productName: string;
  sku: string;
  variantTitle: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface ShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  area?: string;
  postalCode?: string;
  zone: string;
}

interface Order {
  orderNumber: string;
  items: OrderItem[];
  shippingAddress:
    ShippingAddress;

  subtotal: number;
  shippingFee: number;
  total: number;
  currency: string;

  paymentMethod: string;
  paymentStatus: string;
  status: string;

  trackingNumber?: string;

  createdAt?: string;
}

const steps = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
];

const labels:
  Record<
    string,
    string
  > = {
    pending:
      'Order placed',

    confirmed:
      'Confirmed',

    processing:
      'Preparing',

    shipped:
      'Shipped',

    delivered:
      'Delivered',

    cancelled:
      'Cancelled',

    paid:
      'Paid',

    refunded:
      'Refunded',
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

function dateLabel(
  value?: string,
) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-BD',
    {
      dateStyle:
        'medium',
    },
  ).format(
    new Date(
      value,
    ),
  );
}

function StatusProgress({
  status,
}: {
  status: string;
}) {
  if (
    status ===
    'cancelled'
  ) {
    return (
      <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        This order was cancelled.
      </div>
    );
  }

  const current =
    steps.indexOf(
      status,
    );

  return (
    <div className="grid grid-cols-5 gap-2">
      {steps.map(
        (
          step,
          index,
        ) => {
          const done =
            index <=
            current;

          return (
            <div
              key={
                step
              }
            >
              <div
                className={`h-2 rounded-full ${
                  done
                    ? 'bg-[#38205f]'
                    : 'bg-[#e8e2ef]'
                }`}
              />

              <p
                className={`mt-2 text-center text-[11px] font-semibold ${
                  done
                    ? 'text-[#38205f]'
                    : 'text-[#8a8193]'
                }`}
              >
                {
                  labels[
                    step
                  ]
                }
              </p>
            </div>
          );
        },
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [
    orders,
    setOrders,
  ] =
    useState<
      Order[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    authenticated,
    setAuthenticated,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(
    () => {
      async function load() {
        const token =
          getCustomerToken();

        if (!token) {
          setAuthenticated(
            false,
          );

          setLoading(
            false,
          );

          return;
        }

        try {
          const response =
            await fetch(
              `${API_URL}/auth/me/orders`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  'no-store',
              },
            );

          if (
            response.status ===
            401
          ) {
            clearCustomerToken();

            setAuthenticated(
              false,
            );

            return;
          }

          if (
            !response.ok
          ) {
            throw new Error(
              'Unable to load your orders',
            );
          }

          const body =
            await response.json();

          setOrders(
            Array.isArray(
              body,
            )
              ? body
              : [],
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof
              Error
              ? cause.message
              : 'Unable to load your orders',
          );
        } finally {
          setLoading(
            false,
          );
        }
      }

      void load();
    },
    [],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="animate-pulse rounded-3xl border border-[#e8e2ef] bg-white p-8 text-[#6f6679]">
          Loading your orders...
        </div>
      </main>
    );
  }

  if (
    !authenticated
  ) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <section className="rounded-3xl border border-[#e8e2ef] bg-white p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
            Your orders
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#1f1235]">
            Sign in to see your orders
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-[#6f6679]">
            Your purchases, delivery status and tracking details are kept together in your account.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-[#1f1235] px-6 py-3 font-semibold text-white"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
          Your purchases
        </p>

        <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
          My orders
        </h1>

        <p className="mt-3 max-w-2xl text-[#6f6679]">
          Everything you ordered is here automatically. No order number or phone search needed.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-8 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {!error &&
        orders.length ===
          0 && (
          <section className="mt-10 rounded-3xl border border-[#e8e2ef] bg-white p-10 text-center">
            <h2 className="text-2xl font-bold text-[#1f1235]">
              No orders yet
            </h2>

            <p className="mt-2 text-[#6f6679]">
              When you place an order, it will appear here automatically.
            </p>

            <Link
              href="/products"
              className="mt-6 inline-flex rounded-xl bg-[#1f1235] px-6 py-3 font-semibold text-white"
            >
              Start shopping
            </Link>
          </section>
        )}

      <div className="mt-10 space-y-6">
        {orders.map(
          (
            order,
          ) => (
            <article
              key={
                order.orderNumber
              }
              className="overflow-hidden rounded-3xl border border-[#e8e2ef] bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[#e8e2ef] bg-[#faf8fc] px-6 py-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6f6679]">
                    Order
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#1f1235]">
                    {
                      order.orderNumber
                    }
                  </h2>

                  {order.createdAt && (
                    <p className="mt-1 text-sm text-[#6f6679]">
                      {
                        dateLabel(
                          order.createdAt,
                        )
                      }
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="inline-flex rounded-full bg-[#eee7f6] px-4 py-2 text-sm font-bold text-[#38205f]">
                    {
                      labels[
                        order.status
                      ] ??
                      order.status
                    }
                  </span>

                  <p className="mt-2 text-lg font-bold text-[#1f1235]">
                    {
                      money(
                        order.total,
                      )
                    }
                  </p>
                </div>
              </div>

              <div className="p-6">
                <StatusProgress
                  status={
                    order.status
                  }
                />

                <div className="mt-7 divide-y divide-[#eeeaf3]">
                  {order.items.map(
                    (
                      item,
                    ) => (
                      <div
                        key={
                          item.sku
                        }
                        className="flex flex-wrap items-center justify-between gap-4 py-4"
                      >
                        <div>
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="font-bold text-[#1f1235] hover:text-[#4c2a7d]"
                          >
                            {
                              item.productName
                            }
                          </Link>

                          <p className="mt-1 text-sm text-[#6f6679]">
                            {
                              item.variantTitle
                            }
                            {' · '}
                            Qty {
                              item.quantity
                            }
                          </p>
                        </div>

                        <p className="font-semibold text-[#1f1235]">
                          {
                            money(
                              item.lineTotal,
                            )
                          }
                        </p>
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-6 grid gap-4 rounded-2xl bg-[#faf8fc] p-5 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#6f6679]">
                      Delivery
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[#1f1235]">
                      {
                        order.shippingAddress
                          .addressLine1
                      }
                      {order.shippingAddress
                        .area
                        ? `, ${order.shippingAddress.area}`
                        : ''}
                      {`, ${order.shippingAddress.city}`}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#6f6679]">
                      Payment
                    </p>

                    <p className="mt-1 text-sm font-semibold capitalize text-[#1f1235]">
                      COD
                      {' · '}
                      {
                        labels[
                          order.paymentStatus
                        ] ??
                        order.paymentStatus
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#6f6679]">
                      Tracking
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[#1f1235]">
                      {order.trackingNumber
                        ? order.trackingNumber
                        : order.status ===
                            'shipped'
                          ? 'Tracking will update shortly'
                          : 'Available after shipment'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {order.status ===
                    'delivered' && (
                    <Link
                      href={`/returns?order=${encodeURIComponent(
                        order.orderNumber,
                      )}`}
                      className="rounded-xl bg-[#1f1235] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Return items
                    </Link>
                  )}

                  <Link
                    href="/products"
                    className="rounded-xl border border-[#ddd4e8] px-5 py-3 text-sm font-semibold text-[#1f1235]"
                  >
                    Shop again
                  </Link>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </main>
  );
}
