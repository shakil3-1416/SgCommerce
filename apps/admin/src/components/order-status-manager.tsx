'use client';

import {
  useState,
} from 'react';


const statuses = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export function OrderStatusManager({
  orderNumber,
  initialStatus,
  initialTrackingNumber = '',
}: {
  orderNumber: string;
  initialStatus: string;
  initialTrackingNumber?: string;
}) {
  const [
    status,
    setStatus,
  ] =
    useState(
      initialStatus,
    );

  const [
    tracking,
    setTracking,
  ] =
    useState(
      initialTrackingNumber,
    );

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

  async function save() {
    setSaving(true);
    setMessage('');

    const response =
      await fetch(
        `/api/backend/orders/${encodeURIComponent(orderNumber)}/status`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              status,
              trackingNumber:
                tracking,
            }),
        },
      );

    setSaving(false);

    if (!response.ok) {
      setMessage('Save failed');
      return;
    }

    setMessage('Saved');
  }

  return (
    <div className="min-w-48 space-y-2">
      <select
        value={status}
        onChange={(event) =>
          setStatus(
            event.target.value,
          )
        }
        className="w-full rounded-lg border border-[#e8e2ef] bg-white px-3 py-2"
      >
        {statuses.map(
          (value) => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          ),
        )}
      </select>

      <input
        value={tracking}
        onChange={(event) =>
          setTracking(
            event.target.value,
          )
        }
        placeholder="Tracking number"
        className="w-full rounded-lg border border-[#e8e2ef] px-3 py-2"
      />

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full rounded-lg bg-[#1f1235] px-3 py-2 font-semibold text-white"
      >
        Save
      </button>

      {message && (
        <p className="text-xs text-[#6f6679]">
          {message}
        </p>
      )}
    </div>
  );
}
