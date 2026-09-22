'use client';

import {
  useMemo,
  useState,
} from 'react';

export function ProductImageGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const usableImages =
    useMemo(
      () =>
        Array.from(
          new Set(
            (images ?? [])
              .map(
                (image) =>
                  image.trim(),
              )
              .filter(Boolean),
          ),
        ),
      [
        images,
      ],
    );

  const [
    selected,
    setSelected,
  ] =
    useState(0);

  const currentImage =
    usableImages[
      Math.min(
        selected,
        Math.max(
          usableImages.length -
            1,
          0,
        ),
      )
    ];

  if (
    !currentImage
  ) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl bg-[#f2edf8]">
        <span className="text-9xl font-bold text-[#d7cce2]">
          {name.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-[#e8e2ef] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            currentImage
          }
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>

      {usableImages.length >
        1 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {usableImages.map(
            (
              image,
              index,
            ) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() =>
                  setSelected(
                    index,
                  )
                }
                aria-label={`Show ${name} image ${index + 1}`}
                className={`aspect-square overflow-hidden rounded-xl border bg-white ${
                  selected ===
                  index
                    ? 'border-[#38205f] ring-2 ring-[#d7cce2]'
                    : 'border-[#e8e2ef]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
