import Link from 'next/link';

import {
  ClearCart,
} from '@/components/clear-cart';

import {
  confirmationView,
  type ConfirmationView,
} from '@/lib/payments';

const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

type Params = Promise<{
  orderNumber: string;
}>;

/*
 * What the page says for each state of the order. The state comes from
 * the API, never from the address the browser arrived at, so nobody can
 * make this page say "paid" by editing a link.
 */
const VIEWS: Record<
  ConfirmationView,
  {
    mark: string;
    markClass: string;
    title: string;
    text: (orderNumber: string) => string;
  }
> = {
  placed: {
    mark: '✓',
    markClass: 'bg-[#f2edf8] text-[#29164a]',
    title: 'Order placed',
    text: () =>
      'Thank you. You pay in cash when your order arrives.',
  },

  unknown: {
    mark: '✓',
    markClass: 'bg-[#f2edf8] text-[#29164a]',
    title: 'Order placed',
    text: () =>
      'Thank you. Keep your order number to track the order.',
  },

  paid: {
    mark: '✓',
    markClass: 'bg-green-100 text-green-800',
    title: 'Payment received',
    text: () =>
      'Thank you. Your order is placed and paid.',
  },

  'not-completed': {
    mark: '!',
    markClass: 'bg-red-100 text-red-700',
    title: 'Payment not completed',
    text: (orderNumber) =>
      `The payment did not go through, so order ${orderNumber} was cancelled and nothing is owed for it. Your cart is still saved: you can try again or choose cash on delivery.`,
  },

  'cancelled-after-payment': {
    mark: '!',
    markClass: 'bg-amber-100 text-amber-900',
    title: 'Order cancelled',
    text: (orderNumber) =>
      `We received your payment, but order ${orderNumber} was cancelled. Your money will be refunded. Keep this order number and contact us if you have any questions.`,
  },

  confirming: {
    mark: '…',
    markClass: 'bg-amber-100 text-amber-900',
    title: 'Confirming your payment',
    text: (orderNumber) =>
      `This usually takes less than a minute. Check again in a moment. If money has left your account, keep order number ${orderNumber}: the payment will be matched to it.`,
  },
};

export default async function OrderConfirmation({
  params,
}: {
  params: Params;
}) {
  const {
    orderNumber,
  } = await params;

  let summary: Record<string, unknown> | null =
    null;

  try {
    const response =
      await fetch(
        `${API_URL}/payments/status/${encodeURIComponent(orderNumber)}`,
        {
          cache: 'no-store',
        },
      );

    summary =
      response.ok
        ? await response.json()
        : null;
  } catch {
    summary = null;
  }

  const state =
    confirmationView(summary);

  const view = VIEWS[state];

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      {state === 'paid' && (
        <ClearCart />
      )}

      <div className="rounded-3xl border border-[#e8e2ef] bg-white p-10 text-center shadow-sm">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold ${view.markClass}`}
        >
          {view.mark}
        </div>

        <h1 className="mt-6 text-4xl font-bold text-[#1f1235]">
          {view.title}
        </h1>

        <p className="mt-3 text-[#6f6679]">
          Your order number is
        </p>

        <p className="mt-2 text-xl font-bold text-[#29164a]">
          {orderNumber}
        </p>

        <p className="mx-auto mt-5 max-w-xl leading-7 text-[#4f455c]">
          {view.text(orderNumber)}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {state === 'not-completed' ? (
            <Link
              href="/checkout"
              className="rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white"
            >
              Back to checkout
            </Link>
          ) : state === 'confirming' ? (
            <a
              href={`/order-confirmation/${encodeURIComponent(orderNumber)}`}
              className="rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white"
            >
              Check again
            </a>
          ) : (
            <Link
              href="/orders"
              className="rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white"
            >
              Track order
            </Link>
          )}

          <Link
            href="/products"
            className="rounded-xl border border-[#e8e2ef] px-6 py-3 font-bold text-[#1f1235]"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
