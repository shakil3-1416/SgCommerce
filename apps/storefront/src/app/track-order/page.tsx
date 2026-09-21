'use client';

import {
  FormEvent,
  useState,
} from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

export default function TrackOrderPage() {
  const [
    result,
    setResult,
  ] =
    useState<any>(null);

  const [
    error,
    setError,
  ] =
    useState('');

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');
    setResult(null);

    const form =
      new FormData(
        event.currentTarget,
      );

    const orderNumber =
      String(
        form.get(
          'orderNumber',
        ) ?? '',
      );

    const phone =
      String(
        form.get('phone') ??
          '',
      );

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

    setResult(body);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Orders
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Track your order
      </h1>

      <form
        onSubmit={submit}
        className="mt-8 rounded-3xl border border-[#e8e2ef] bg-white p-7"
      >
        <div className="grid gap-5">
          <label>
            <span className="text-sm font-semibold">
              Order number
            </span>

            <input
              required
              name="orderNumber"
              placeholder="SG-..."
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <label>
            <span className="text-sm font-semibold">
              Phone number
            </span>

            <input
              required
              name="phone"
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <button className="rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white">
            Track order
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-3xl bg-[#1f1235] p-7 text-white">
          <p className="text-sm text-purple-200">
            {result.orderNumber}
          </p>

          <h2 className="mt-2 text-2xl font-bold capitalize">
            {result.status}
          </h2>

          {result.trackingNumber && (
            <p className="mt-3 text-purple-100">
              Tracking:{' '}
              {result.trackingNumber}
            </p>
          )}

          <p className="mt-5 text-purple-100">
            Total: ৳{result.total}
          </p>
        </div>
      )}
    </main>
  );
}
