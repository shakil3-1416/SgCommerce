'use client';

import {
  useState,
} from 'react';


export function InventoryAdjuster({
  sku,
}: {
  sku: string;
}) {
  const [
    delta,
    setDelta,
  ] =
    useState('');

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState('');

  async function submit() {
    const numeric =
      Number(delta);

    if (
      !Number.isInteger(
        numeric,
      ) ||
      numeric === 0
    ) {
      setMessage(
        'Use a non-zero whole number',
      );
      return;
    }

    setSaving(true);
    setMessage('');

    const response =
      await fetch(
        `/api/backend/inventory/${encodeURIComponent(sku)}/adjust`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              delta: numeric,
              reason:
                'admin_adjustment',
              reference:
                'admin_console',
            }),
        },
      );

    setSaving(false);

    if (!response.ok) {
      const body =
        await response.json();

      setMessage(
        body.message ??
          'Adjustment failed',
      );

      return;
    }

    setDelta('');
    setMessage('Saved');

    window.location.reload();
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="number"
          value={delta}
          onChange={(event) =>
            setDelta(
              event.target.value,
            )
          }
          aria-label={`Stock adjustment for ${sku}`}
          placeholder="+10 / -2"
          className="w-28 rounded-lg border border-[#e8e2ef] px-3 py-2"
        />

        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="rounded-lg bg-[#1f1235] px-3 py-2 font-semibold text-white"
        >
          Adjust
        </button>
      </div>

      {message && (
        <p className="mt-1 text-xs text-[#6f6679]">
          {message}
        </p>
      )}
    </div>
  );
}
