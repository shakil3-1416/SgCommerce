'use client';

import {
  useRouter,
} from 'next/navigation';

import {
  useState,
} from 'react';

/**
 * The two things a merchant can do about an online payment:
 * ask SSLCOMMERZ what happened to it, and record that a refund was made.
 */
export function OrderPaymentActions({
  orderNumber,
  canCheck,
  canMarkRefunded,
}: {
  orderNumber: string;
  canCheck: boolean;
  canMarkRefunded: boolean;
}) {
  const router = useRouter();

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState('');

  if (!canCheck && !canMarkRefunded) {
    return null;
  }

  async function send(
    path: string,
    method: 'POST' | 'PATCH',
    done: (body: any) => string,
  ) {
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch(
        `/api/backend/${path}`,
        { method },
      );

      const body = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        const reason =
          Array.isArray(body?.message)
            ? body.message.join(', ')
            : body?.message;

        setMessage(
          typeof reason === 'string' && reason
            ? reason
            : 'That did not work. Try again.',
        );

        return;
      }

      setMessage(done(body));

      // Reload the page data so the order shows its new state.
      router.refresh();
    } catch {
      setMessage(
        'Check your internet connection, then try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {canCheck && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              send(
                `payments/${encodeURIComponent(orderNumber)}/check`,
                'POST',
                (body) =>
                  typeof body?.message === 'string'
                    ? body.message
                    : 'Checked.',
              )
            }
            className="rounded-lg border border-[#d8cee6] bg-white px-3 py-2 text-xs font-semibold text-[#38205f] disabled:opacity-60"
          >
            Check with SSLCOMMERZ
          </button>
        )}

        {canMarkRefunded && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Have you refunded order ${orderNumber} in the SSLCOMMERZ merchant panel? This only records it here; it does not send any money.`,
                )
              ) {
                void send(
                  `orders/${encodeURIComponent(orderNumber)}/refunded`,
                  'PATCH',
                  () => 'Marked as refunded.',
                );
              }
            }}
            className="rounded-lg bg-[#1f1235] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            Mark as refunded
          </button>
        )}
      </div>

      {message && (
        <p
          role="status"
          className="text-xs text-[#4f455c]"
        >
          {message}
        </p>
      )}
    </div>
  );
}
