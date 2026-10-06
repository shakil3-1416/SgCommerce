'use client';

import {
  type ReactNode,
  useState,
} from 'react';

import {
  barHeights,
  firstRequest,
  type Tone,
  type UsageDay,
} from '@/lib/developer-applications';

/*
 * Components only. Plain helpers (time formatting, wording) live in
 * lib/developer-applications.ts, because server-rendered pages use them
 * too and may not call a function that lives in a "use client" file.
 */

const TONES: Record<Tone, string> = {
  good: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-900',
  bad: 'bg-red-100 text-red-800',
  muted: 'bg-[#f2edf8] text-[#6f6679]',
};

export function Badge({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function CopyButton({
  text,
  label = 'Copy',
  className = 'rounded-lg border border-[#d8cee6] bg-white px-3 py-1.5 text-xs font-semibold text-[#38205f]',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] =
    useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The text is on screen and can be selected by hand.
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={className}
      >
        {copied ? 'Copied' : label}
      </button>

      {/* Announced by screen readers; the button's own text changes for everyone else. */}
      <span
        role="status"
        className="sr-only"
      >
        {copied ? 'Copied to the clipboard' : ''}
      </span>
    </>
  );
}

/**
 * A key, shown the one time it can be shown: right after an application
 * is created or its key is replaced. It lives only in the page's memory.
 */
export function IssuedKey({
  name,
  secret,
  apiUrl,
  note,
}: {
  name: string;
  secret: string;
  apiUrl: string;
  note?: string;
}) {
  return (
    <section
      aria-label="New API key"
      className="rounded-2xl border-2 border-[#38205f] bg-[#faf8fc] p-6"
    >
      <h2 className="text-lg font-bold text-[#1f1235]">
        Key for {name}
      </h2>

      <p className="mt-1 text-sm text-[#4f455c]">
        Copy it now and store it somewhere safe, such as a password
        manager. It is shown only this once: when you leave or reload
        this page it cannot be shown again.
        {note ? ` ${note}` : ''}
      </p>

      <p className="mt-4 break-all rounded-xl border border-[#d8cee6] bg-white px-4 py-3 font-mono text-sm text-[#1f1235]">
        {secret}
      </p>

      <div className="mt-3">
        <CopyButton
          text={secret}
          label="Copy key"
          className="rounded-lg bg-[#1f1235] px-4 py-2 text-sm font-semibold text-white"
        />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#1f1235]">
        A first request to check it works
      </p>

      <pre className="mt-2 overflow-x-auto rounded-xl bg-[#1f1235] px-4 py-3 text-xs text-white">
        {firstRequest(apiUrl, secret)}
      </pre>
    </section>
  );
}

/** Seven days of requests as bars, with the numbers available to screen readers. */
export function UsageBars({
  week,
}: {
  week: UsageDay[];
}) {
  const heights = barHeights(week);

  return (
    <ol
      aria-label="Requests per day, last 7 days"
      className="flex h-24 items-end gap-2"
    >
      {week.map((day, index) => (
        <li
          key={day.day}
          title={`${day.day}: ${day.requests} requests, ${day.errors} errors`}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="sr-only">
            {day.day}: {day.requests} requests, {day.errors} errors
          </span>

          <span
            aria-hidden="true"
            className="w-full rounded-t bg-[#4c2a7d]"
            style={{
              height: `${heights[index] ?? 0}%`,
              minHeight: day.requests > 0 ? 3 : 1,
              opacity: day.requests > 0 ? 1 : 0.2,
            }}
          />

          <span
            aria-hidden="true"
            className="text-[10px] text-[#6f6679]"
          >
            {day.day.slice(8)}
          </span>
        </li>
      ))}
    </ol>
  );
}
