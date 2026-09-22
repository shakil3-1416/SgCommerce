'use client';

import Link from 'next/link';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  clearCustomerToken,
  getCustomerToken,
} from '@/lib/customer-auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface Account {
  customer: {
    name: string;
    phone: string;
    email: string;
  };
}

interface OrderItem {
  productSlug: string;
  productName: string;
  sku: string;
  variantTitle: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface Order {
  orderNumber: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status: string;
  createdAt?: string;
}

interface ReturnItem {
  sku: string;
  productName: string;
  variantTitle: string;
  quantity: number;
  refundAmount: number;
}

interface ReturnRequest {
  returnNumber: string;
  orderNumber: string;
  items: ReturnItem[];
  reason: string;
  details?: string;
  refundAmount: number;
  status: string;
  createdAt?: string;
}

type Quantities =
  Record<
    string,
    Record<
      string,
      number
    >
  >;

const statusLabels:
  Record<
    string,
    string
  > = {
    requested:
      'Requested',

    approved:
      'Approved',

    rejected:
      'Rejected',

    received:
      'Received',

    completed:
      'Completed',
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

export default function ReturnsPage() {
  const [
    account,
    setAccount,
  ] =
    useState<
      Account | null
    >(null);

  const [
    orders,
    setOrders,
  ] =
    useState<
      Order[]
    >([]);

  const [
    returns,
    setReturns,
  ] =
    useState<
      ReturnRequest[]
    >([]);

  const [
    quantities,
    setQuantities,
  ] =
    useState<
      Quantities
    >({});

  const [
    reasons,
    setReasons,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    details,
    setDetails,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    submitting,
    setSubmitting,
  ] =
    useState<
      string | null
    >(null);

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

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    preferredOrder,
    setPreferredOrder,
  ] =
    useState('');

  async function authFetch(
    path: string,
    init?: RequestInit,
  ) {
    const token =
      getCustomerToken();

    if (!token) {
      throw new Error(
        'NO_TOKEN',
      );
    }

    return fetch(
      `${API_URL}${path}`,
      {
        ...init,

        headers: {
          ...(init?.headers ??
            {}),

          Authorization:
            `Bearer ${token}`,

          ...(init?.body
            ? {
                'Content-Type':
                  'application/json',
              }
            : {}),
        },

        cache:
          'no-store',
      },
    );
  }

  async function refresh(
    firstLoad =
      false,
  ) {
    if (firstLoad) {
      setLoading(
        true,
      );
    }

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
      const [
        accountResponse,
        ordersResponse,
        returnsResponse,
      ] =
        await Promise.all([
          authFetch(
            '/auth/me',
          ),

          authFetch(
            '/auth/me/orders',
          ),

          authFetch(
            '/returns/me',
          ),
        ]);

      if (
        accountResponse.status ===
          401 ||
        ordersResponse.status ===
          401 ||
        returnsResponse.status ===
          401
      ) {
        clearCustomerToken();

        setAuthenticated(
          false,
        );

        return;
      }

      if (
        !accountResponse.ok ||
        !ordersResponse.ok ||
        !returnsResponse.ok
      ) {
        throw new Error(
          'Unable to load your returns',
        );
      }

      setAccount(
        await accountResponse.json(),
      );

      const orderBody =
        await ordersResponse.json();

      setOrders(
        Array.isArray(
          orderBody,
        )
          ? orderBody
          : [],
      );

      const returnBody =
        await returnsResponse.json();

      setReturns(
        Array.isArray(
          returnBody,
        )
          ? returnBody
          : [],
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Unable to load your returns',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  useEffect(
    () => {
      if (
        typeof window !==
        'undefined'
      ) {
        const params =
          new URLSearchParams(
            window.location.search,
          );

        setPreferredOrder(
          params.get(
            'order',
          ) ?? '',
        );
      }

      void refresh(
        true,
      );
    },
    [],
  );

  const deliveredOrders =
    useMemo(
      () =>
        orders.filter(
          (
            order,
          ) =>
            order.status ===
            'delivered',
        ),
      [
        orders,
      ],
    );

  function alreadyReturned(
    orderNumber:
      string,
    sku:
      string,
  ) {
    return returns
      .filter(
        (
          request,
        ) =>
          request.orderNumber ===
            orderNumber &&
          request.status !==
            'rejected',
      )
      .flatMap(
        (
          request,
        ) =>
          request.items,
      )
      .filter(
        (
          item,
        ) =>
          item.sku ===
          sku,
      )
      .reduce(
        (
          total,
          item,
        ) =>
          total +
          item.quantity,
        0,
      );
  }

  function remainingQuantity(
    order:
      Order,
    item:
      OrderItem,
  ) {
    return Math.max(
      0,
      item.quantity -
        alreadyReturned(
          order.orderNumber,
          item.sku,
        ),
    );
  }

  function setQuantity(
    orderNumber:
      string,
    sku:
      string,
    quantity:
      number,
  ) {
    setQuantities(
      (
        current,
      ) => ({
        ...current,

        [
          orderNumber
        ]: {
          ...(
            current[
              orderNumber
            ] ??
            {}
          ),

          [sku]:
            quantity,
        },
      }),
    );
  }

  async function submitReturn(
    order:
      Order,
  ) {
    if (!account) {
      return;
    }

    const items =
      order.items
        .map(
          (
            item,
          ) => ({
            sku:
              item.sku,

            quantity:
              quantities[
                order.orderNumber
              ]?.[
                item.sku
              ] ??
              0,
          }),
        )
        .filter(
          (
            item,
          ) =>
            item.quantity >
            0,
        );

    if (
      items.length ===
      0
    ) {
      setError(
        'Choose at least one item to return.',
      );

      return;
    }

    const reason =
      reasons[
        order.orderNumber
      ]?.trim();

    if (!reason) {
      setError(
        'Choose a return reason.',
      );

      return;
    }

    setError('');
    setMessage('');
    setSubmitting(
      order.orderNumber,
    );

    try {
      const response =
        await fetch(
          `${API_URL}/returns`,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                orderNumber:
                  order.orderNumber,

                phone:
                  account.customer
                    .phone,

                items,

                reason,

                details:
                  details[
                    order.orderNumber
                  ]?.trim() ??
                  '',
              }),
          },
        );

      if (
        !response.ok
      ) {
        let responseMessage =
          'Unable to submit your return request';

        try {
          const body =
            await response.json();

          if (
            Array.isArray(
              body.message,
            )
          ) {
            responseMessage =
              body.message.join(
                ', ',
              );
          } else if (
            typeof body.message ===
              'string'
          ) {
            responseMessage =
              body.message;
          }
        } catch {
          // Friendly fallback.
        }

        throw new Error(
          responseMessage,
        );
      }

      setQuantities(
        (
          current,
        ) => ({
          ...current,

          [
            order.orderNumber
          ]: {},
        }),
      );

      setReasons(
        (
          current,
        ) => ({
          ...current,

          [
            order.orderNumber
          ]: '',
        }),
      );

      setDetails(
        (
          current,
        ) => ({
          ...current,

          [
            order.orderNumber
          ]: '',
        }),
      );

      setMessage(
        `Return request sent for ${order.orderNumber}.`,
      );

      await refresh();
    } catch (
      cause
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : 'Unable to submit your return request',
      );
    } finally {
      setSubmitting(
        null,
      );
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="animate-pulse rounded-3xl border border-[#e8e2ef] bg-white p-8 text-[#6f6679]">
          Loading your orders and returns...
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
            Returns
          </p>

          <h1 className="mt-3 text-3xl font-bold text-[#1f1235]">
            Sign in to manage returns
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-[#6f6679]">
            We will automatically show the orders and items that are eligible for return.
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
          Easy returns
        </p>

        <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
          Returns
        </h1>

        <p className="mt-3 max-w-2xl text-[#6f6679]">
          Choose a delivered order, select what you want to return, and send the request. Your order number and phone are filled automatically.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-7 rounded-2xl bg-red-50 px-5 py-4 text-sm font-semibold text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mt-7 rounded-2xl bg-green-50 px-5 py-4 text-sm font-semibold text-green-800"
        >
          {message}
        </div>
      )}

      {returns.length >
        0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-5">
            <div>
              <h2 className="text-2xl font-bold text-[#1f1235]">
                My return requests
              </h2>

              <p className="mt-1 text-sm text-[#6f6679]">
                You can follow each request here.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {returns.map(
              (
                request,
              ) => (
                <article
                  key={
                    request.returnNumber
                  }
                  className="rounded-3xl border border-[#e8e2ef] bg-white p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#6f6679]">
                        {
                          request.returnNumber
                        }
                      </p>

                      <h3 className="mt-1 font-bold text-[#1f1235]">
                        Order{' '}
                        {
                          request.orderNumber
                        }
                      </h3>

                      {request.createdAt && (
                        <p className="mt-1 text-sm text-[#6f6679]">
                          {
                            dateLabel(
                              request.createdAt,
                            )
                          }
                        </p>
                      )}
                    </div>

                    <span className="rounded-full bg-[#eee7f6] px-3 py-2 text-xs font-bold text-[#38205f]">
                      {
                        statusLabels[
                          request.status
                        ] ??
                        request.status
                      }
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {request.items.map(
                      (
                        item,
                      ) => (
                        <div
                          key={
                            item.sku
                          }
                          className="flex justify-between gap-4 text-sm"
                        >
                          <span className="text-[#6f6679]">
                            {
                              item.productName
                            }
                            {' × '}
                            {
                              item.quantity
                            }
                          </span>

                          <span className="font-semibold text-[#1f1235]">
                            {
                              money(
                                item.refundAmount,
                              )
                            }
                          </span>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-4 border-t border-[#eeeaf3] pt-4">
                    <p className="text-sm text-[#6f6679]">
                      Expected refund
                    </p>

                    <p className="mt-1 text-lg font-bold text-[#1f1235]">
                      {
                        money(
                          request.refundAmount,
                        )
                      }
                    </p>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[#1f1235]">
          Choose an order
        </h2>

        <p className="mt-1 text-sm text-[#6f6679]">
          Only delivered orders are shown because returns start after delivery.
        </p>

        {deliveredOrders.length ===
          0 && (
          <div className="mt-5 rounded-3xl border border-[#e8e2ef] bg-white p-8">
            <h3 className="text-xl font-bold text-[#1f1235]">
              No delivered orders ready for return
            </h3>

            <p className="mt-2 text-[#6f6679]">
              Once an order is delivered, eligible items will appear here automatically.
            </p>

            <Link
              href="/orders"
              className="mt-5 inline-flex rounded-xl border border-[#ddd4e8] px-5 py-3 text-sm font-semibold text-[#1f1235]"
            >
              View my orders
            </Link>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {deliveredOrders.map(
            (
              order,
            ) => {
              const availableItems =
                order.items.filter(
                  (
                    item,
                  ) =>
                    remainingQuantity(
                      order,
                      item,
                    ) >
                    0,
                );

              const highlighted =
                preferredOrder ===
                order.orderNumber;

              return (
                <article
                  key={
                    order.orderNumber
                  }
                  className={`rounded-3xl border bg-white p-6 ${
                    highlighted
                      ? 'border-[#6b46a1] ring-2 ring-[#ede5f6]'
                      : 'border-[#e8e2ef]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#6f6679]">
                        Delivered order
                      </p>

                      <h3 className="mt-1 text-xl font-bold text-[#1f1235]">
                        {
                          order.orderNumber
                        }
                      </h3>

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

                    <p className="text-lg font-bold text-[#1f1235]">
                      {
                        money(
                          order.total,
                        )
                      }
                    </p>
                  </div>

                  {availableItems.length ===
                  0 ? (
                    <div className="mt-6 rounded-2xl bg-[#faf8fc] px-5 py-4 text-sm text-[#6f6679]">
                      All eligible quantities from this order already have return requests.
                    </div>
                  ) : (
                    <>
                      <div className="mt-6 divide-y divide-[#eeeaf3] border-y border-[#eeeaf3]">
                        {order.items.map(
                          (
                            item,
                          ) => {
                            const remaining =
                              remainingQuantity(
                                order,
                                item,
                              );

                            if (
                              remaining ===
                              0
                            ) {
                              return (
                                <div
                                  key={
                                    item.sku
                                  }
                                  className="flex flex-wrap items-center justify-between gap-4 py-4 opacity-60"
                                >
                                  <div>
                                    <p className="font-semibold text-[#1f1235]">
                                      {
                                        item.productName
                                      }
                                    </p>

                                    <p className="mt-1 text-sm text-[#6f6679]">
                                      {
                                        item.variantTitle
                                      }
                                      {' · '}
                                      Return already requested
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            const value =
                              quantities[
                                order.orderNumber
                              ]?.[
                                item.sku
                              ] ??
                              0;

                            return (
                              <div
                                key={
                                  item.sku
                                }
                                className="flex flex-wrap items-center justify-between gap-5 py-4"
                              >
                                <div>
                                  <Link
                                    href={`/products/${item.productSlug}`}
                                    className="font-semibold text-[#1f1235] hover:text-[#4c2a7d]"
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
                                    {
                                      remaining
                                    } eligible
                                  </p>
                                </div>

                                <label className="flex items-center gap-3 text-sm font-semibold text-[#1f1235]">
                                  Return qty

                                  <select
                                    aria-label={`Return quantity for ${item.productName}`}
                                    value={
                                      value
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      setQuantity(
                                        order.orderNumber,
                                        item.sku,
                                        Number(
                                          event.target
                                            .value,
                                        ),
                                      )
                                    }
                                    className="rounded-xl border border-[#ddd4e8] bg-white px-3 py-2"
                                  >
                                    <option value="0">
                                      0
                                    </option>

                                    {Array.from(
                                      {
                                        length:
                                          remaining,
                                      },
                                      (
                                        _,
                                        index,
                                      ) =>
                                        index +
                                        1,
                                    ).map(
                                      (
                                        quantity,
                                      ) => (
                                        <option
                                          key={
                                            quantity
                                          }
                                          value={
                                            quantity
                                          }
                                        >
                                          {
                                            quantity
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </label>
                              </div>
                            );
                          },
                        )}
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-semibold text-[#1f1235]">
                          Reason

                          <select
                            value={
                              reasons[
                                order.orderNumber
                              ] ??
                              ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setReasons(
                                (
                                  current,
                                ) => ({
                                  ...current,

                                  [
                                    order.orderNumber
                                  ]:
                                    event.target
                                      .value,
                                }),
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-[#ddd4e8] bg-white px-4 py-3"
                          >
                            <option value="">
                              Choose a reason
                            </option>

                            <option value="Damaged item">
                              Damaged item
                            </option>

                            <option value="Wrong item received">
                              Wrong item received
                            </option>

                            <option value="Not as described">
                              Not as described
                            </option>

                            <option value="Size or fit issue">
                              Size or fit issue
                            </option>

                            <option value="Changed my mind">
                              Changed my mind
                            </option>

                            <option value="Other">
                              Other
                            </option>
                          </select>
                        </label>

                        <label className="text-sm font-semibold text-[#1f1235]">
                          Anything else?{' '}
                          <span className="font-normal text-[#6f6679]">
                            Optional
                          </span>

                          <textarea
                            value={
                              details[
                                order.orderNumber
                              ] ??
                              ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setDetails(
                                (
                                  current,
                                ) => ({
                                  ...current,

                                  [
                                    order.orderNumber
                                  ]:
                                    event.target
                                      .value,
                                }),
                              )
                            }
                            rows={
                              3
                            }
                            placeholder="Add a short note if needed"
                            className="mt-2 w-full resize-none rounded-xl border border-[#ddd4e8] px-4 py-3"
                          />
                        </label>
                      </div>

                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          disabled={
                            submitting ===
                            order.orderNumber
                          }
                          onClick={() =>
                            void submitReturn(
                              order,
                            )
                          }
                          className="rounded-xl bg-[#1f1235] px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ===
                          order.orderNumber
                            ? 'Sending request...'
                            : 'Submit return request'}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            },
          )}
        </div>
      </section>
    </main>
  );
}
