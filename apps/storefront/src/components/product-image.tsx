'use client';

import {
  useState,
} from 'react';

export function ProductImage({
  src,
  alt,
  className =
    '',
  fallbackText,
  loading =
    'lazy',
}: {
  src?:
    | string
    | null;

  alt: string;

  className?:
    string;

  fallbackText?:
    string;

  loading?:
    'eager'
    | 'lazy';
}) {
  const [
    failed,
    setFailed,
  ] =
    useState(false);

  const usable =
    Boolean(
      src?.trim(),
    ) &&
    !failed;

  if (!usable) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-[#f2edf8] ${className}`}
        role="img"
        aria-label={
          alt
        }
      >
        <span className="px-4 text-center text-sm font-semibold text-[#6f6679]">
          {fallbackText ??
            alt}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        src!
      }
      alt={alt}
      loading={
        loading
      }
      decoding="async"
      onError={() =>
        setFailed(
          true,
        )
      }
      className={
        className
      }
    />
  );
}
