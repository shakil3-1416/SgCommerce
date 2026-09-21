'use client';

import {
  useState,
} from 'react';


const nextStatuses:
  Record<
    string,
    string[]
  > = {
    requested: [
      'approved',
      'rejected',
    ],

    approved: [
      'received',
    ],

    received: [
      'completed',
    ],

    rejected: [],
    completed: [],
  };

export function ReturnStatusManager({
  returnNumber,
  initialStatus,
}: {
  returnNumber: string;
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

  const options =
    nextStatuses[
      status
    ] ?? [];

  async function update(
    next: string,
  ) {
    setSaving(true);

    const response =
      await fetch(
        `/api/backend/returns/${encodeURIComponent(returnNumber)}/status`,
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
      window.location.reload();
    }
  }

  if (
    options.length === 0
  ) {
    return (
      <span className="capitalize">
        {status}
      </span>
    );
  }

  return (
    <select
      value=""
      disabled={saving}
      onChange={(event) => {
        if (
          event.target.value
        ) {
          void update(
            event.target
              .value,
          );
        }
      }}
      className="rounded-lg border border-[#e8e2ef] bg-white px-3 py-2"
    >
      <option value="">
        {status}
      </option>

      {options.map(
        (value) => (
          <option
            key={value}
            value={value}
          >
            → {value}
          </option>
        ),
      )}
    </select>
  );
}
