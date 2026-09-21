import Link from 'next/link';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

type Params = Promise<{
  orderNumber: string;
}>;

export default async function OrderConfirmation({
  params,
}: {
  params: Params;
}) {
  const {
    orderNumber,
  } = await params;

  const response =
    await fetch(
      `${API_URL}/orders/${encodeURIComponent(orderNumber)}`,
      {
        cache: 'no-store',
      },
    );

  const order =
    response.ok
      ? await response.json()
      : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-3xl border border-[#e8e2ef] bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f2edf8] text-2xl font-bold text-[#29164a]">
          ✓
        </div>

        <h1 className="mt-6 text-4xl font-bold text-[#1f1235]">
          Order placed
        </h1>

        <p className="mt-3 text-[#6f6679]">
          Your order number is
        </p>

        <p className="mt-2 text-xl font-bold text-[#29164a]">
          {orderNumber}
        </p>

        {order && (
          <div className="mt-8 rounded-2xl bg-[#faf8fc] p-5 text-left">
            <p>
              <strong>Status:</strong>{' '}
              {order.status}
            </p>

            <p className="mt-2">
              <strong>
                Payment:
              </strong>{' '}
              Cash on Delivery
            </p>

            <p className="mt-2">
              <strong>Total:</strong>{' '}
              ৳{order.total}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/track-order"
            className="rounded-xl bg-[#1f1235] px-6 py-3 font-bold text-white"
          >
            Track order
          </Link>

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
