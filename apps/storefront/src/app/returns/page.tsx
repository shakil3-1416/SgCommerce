'use client';

import {
  FormEvent,
  useState,
} from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface OrderItem {
  sku: string;
  productName: string;
  variantTitle: string;
  quantity: number;
  unitPrice: number;
}

interface TrackedOrder {
  orderNumber: string;
  status: string;
  items: OrderItem[];
}

export default function ReturnsPage() {
  const [
    order,
    setOrder,
  ] =
    useState<TrackedOrder | null>(
      null,
    );

  const [
    orderNumber,
    setOrderNumber,
  ] =
    useState('');

  const [
    phone,
    setPhone,
  ] =
    useState('');

  const [
    selectedSku,
    setSelectedSku,
  ] =
    useState('');

  const [
    quantity,
    setQuantity,
  ] =
    useState(1);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  async function loadOrder(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setSuccess('');
    setOrder(null);

    const response =
      await fetch(
        `${API_URL}/orders/track/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`,
        {
          cache: 'no-store',
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      setError(
        body.message ??
          'Order not found',
      );
      return;
    }

    if (
      body.status !==
      'delivered'
    ) {
      setError(
        'Returns are available after the order has been delivered.',
      );
      return;
    }

    setOrder(body);

    if (
      body.items?.[0]
    ) {
      setSelectedSku(
        body.items[0].sku,
      );
      setQuantity(1);
    }
  }

  const selectedItem =
    order?.items.find(
      (item) =>
        item.sku ===
        selectedSku,
    );

  async function requestReturn(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !order ||
      !selectedItem
    ) {
      return;
    }

    setError('');
    setSuccess('');

    const form =
      new FormData(
        event.currentTarget,
      );

    const response =
      await fetch(
        `${API_URL}/returns`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              orderNumber:
                order.orderNumber,

              phone,

              items: [
                {
                  sku:
                    selectedSku,

                  quantity,
                },
              ],

              reason:
                String(
                  form.get(
                    'reason',
                  ) ?? '',
                ),

              details:
                String(
                  form.get(
                    'details',
                  ) ?? '',
                ),
            }),
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      setError(
        body.message ??
          'Unable to create return request',
      );
      return;
    }

    setSuccess(
      `Return request created: ${body.returnNumber}`,
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        After sales
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Request a return
      </h1>

      <p className="mt-3 text-[#6f6679]">
        Find a delivered order using
        its order number and phone number.
      </p>

      <form
        onSubmit={loadOrder}
        className="mt-8 rounded-3xl border border-[#e8e2ef] bg-white p-7"
      >
        <div className="grid gap-5">
          <label>
            <span className="text-sm font-semibold">
              Order number
            </span>

            <input
              required
              value={orderNumber}
              onChange={(event) =>
                setOrderNumber(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
              placeholder="SG-..."
            />
          </label>

          <label>
            <span className="text-sm font-semibold">
              Phone number
            </span>

            <input
              required
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <button className="rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white hover:bg-[#38205f]">
            Find delivered order
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {order && (
        <form
          onSubmit={
            requestReturn
          }
          className="mt-8 rounded-3xl border border-[#e8e2ef] bg-[#faf8fc] p-7"
        >
          <h2 className="text-xl font-bold text-[#1f1235]">
            Return items
          </h2>

          <label className="mt-6 block">
            <span className="text-sm font-semibold">
              Item
            </span>

            <select
              value={
                selectedSku
              }
              onChange={(event) => {
                setSelectedSku(
                  event.target
                    .value,
                );

                setQuantity(1);
              }}
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            >
              {order.items.map(
                (item) => (
                  <option
                    key={item.sku}
                    value={item.sku}
                  >
                    {
                      item.productName
                    }{' '}
                    -{' '}
                    {
                      item.variantTitle
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          {selectedItem && (
            <label className="mt-5 block">
              <span className="text-sm font-semibold">
                Quantity
              </span>

              <input
                type="number"
                min={1}
                max={
                  selectedItem.quantity
                }
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
                className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
              />
            </label>
          )}

          <label className="mt-5 block">
            <span className="text-sm font-semibold">
              Reason
            </span>

            <select
              required
              name="reason"
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            >
              <option value="wrong_item">
                Wrong item
              </option>

              <option value="damaged">
                Damaged product
              </option>

              <option value="size_issue">
                Size issue
              </option>

              <option value="not_as_expected">
                Not as expected
              </option>

              <option value="other">
                Other
              </option>
            </select>
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-semibold">
              Details
            </span>

            <textarea
              name="details"
              rows={4}
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            />
          </label>

          <button className="mt-6 w-full rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white hover:bg-[#38205f]">
            Submit return request
          </button>
        </form>
      )}

      {success && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 font-semibold text-emerald-700">
          {success}
        </div>
      )}
    </main>
  );
}
