'use client';

import {
  useState,
} from 'react';


export function RefundManager({
  refundNumber,
  initialStatus,
}: {
  refundNumber: string;
  initialStatus: string;
}) {
  const [
    status,
    setStatus,
  ] =
    useState(
      initialStatus,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  async function update(
    next: string,
  ) {
    setSaving(true);

    const response =
      await fetch(
        `/api/backend/refunds/${encodeURIComponent(refundNumber)}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              status: next,
            }),
        },
      );

    setSaving(false);

    if (
      response.ok
    ) {
      setStatus(next);
    }
  }

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(event) =>
        void update(
          event.target.value,
        )
      }
      className="rounded-lg border border-[#e8e2ef] bg-white px-3 py-2"
    >
      <option value="pending">
        pending
      </option>

      <option value="completed">
        completed
      </option>

      <option value="failed">
        failed
      </option>
    </select>
  );
}
