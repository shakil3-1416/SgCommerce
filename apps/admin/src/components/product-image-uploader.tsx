'use client';

import { uploadPresigned } from '@vercel/blob/client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_TYPES_LABEL,
  describeBytes,
  explainUploadFailure,
  isAllowedImageType,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  MAX_PRODUCT_IMAGES,
  moveImage,
  uniqueImages,
  UPLOAD_ENDPOINT,
  uploadPathFor,
} from '@/lib/product-images';

interface ProductImageUploaderProps {
  /** Image URLs in display order. The first one is the main image. */
  images: string[];
  /** Called with the full, updated list after every upload, move or removal. */
  onChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
  /** Called with true when uploads start and false when they finish, so the form can hold its Save button. */
  onBusyChange?: (busy: boolean) => void;
}

interface UploadProgress {
  name: string;
  position: number;
  total: number;
  percentage: number;
}

function draggedFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

const ICON_PATHS = {
  earlier: 'M10 3 5 8l5 5',
  later: 'm6 3 5 5-5 5',
  remove:
    'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 7.6a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.5-7.6M6.8 7v3.5M9.2 7v3.5',
} as const;

function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/*
 * Three equal icon buttons per image. Icons rather than words because a
 * tile is only about 120px wide on a phone; every button carries an
 * aria-label and a tooltip. 44px tall to match the admin's touch targets.
 */
const tileButton =
  'flex min-h-11 min-w-0 flex-1 items-center justify-center text-[#38205f] transition-colors hover:bg-[#f7f4fa] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4c2a7d] disabled:cursor-not-allowed disabled:text-[#b9b1c4] disabled:hover:bg-transparent aria-disabled:cursor-not-allowed aria-disabled:text-[#b9b1c4] aria-disabled:hover:bg-transparent';

/**
 * Product images for the admin product form.
 *
 * Files go from the browser straight to storage; this component hands the
 * form a list of image URLs, which is the shape the product already stores.
 *
 *   <ProductImageUploader images={form.images} onChange={setImages} />
 */
export function ProductImageUploader({
  images,
  onChange,
  maxImages = MAX_PRODUCT_IMAGES,
  disabled = false,
  onBusyChange,
}: ProductImageUploaderProps) {
  const labelId = useId();
  const helpId = useId();

  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  /*
   * The list as of the latest change. Uploads finish long after the click
   * that started them, so they must add to the current list, not to the one
   * that existed when the files were chosen.
   */
  const latest = useRef(images);

  useEffect(() => {
    latest.current = images;
  }, [images]);

  // The form is told when uploads start and stop, including when this
  // component is removed halfway through an upload.
  const busyChange = useRef(onBusyChange);
  const uploadsRunning = useRef(false);

  useEffect(() => {
    busyChange.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;

      if (uploadsRunning.current) {
        uploadsRunning.current = false;
        busyChange.current?.(false);
      }
    };
  }, []);

  const shown = uniqueImages(images);
  const uploading = progress !== null;
  const locked = disabled || uploading;
  const full = shown.length >= maxImages;

  function commit(next: readonly string[]) {
    const unique = uniqueImages(next);

    latest.current = unique;
    onChange(unique);
  }

  async function addFiles(files: File[]) {
    if (files.length === 0 || locked) {
      return;
    }

    const found: string[] = [];
    const accepted: File[] = [];
    let room = maxImages - uniqueImages(latest.current).length;

    for (const file of files) {
      if (!isAllowedImageType(file.type)) {
        found.push(
          `"${file.name}" is not a ${ALLOWED_IMAGE_TYPES_LABEL} image. Convert it, then upload it again.`,
        );
      } else if (file.size > MAX_IMAGE_BYTES) {
        found.push(
          `"${file.name}" is ${describeBytes(file.size)}. Images can be up to ${MAX_IMAGE_MB} MB. Compress it, then upload it again.`,
        );
      } else if (room <= 0) {
        found.push(
          `"${file.name}" was not added. A product can have ${maxImages} images. Remove one first.`,
        );
      } else {
        room -= 1;
        accepted.push(file);
      }
    }

    setProblems(found);

    if (accepted.length === 0) {
      return;
    }

    uploadsRunning.current = true;
    busyChange.current?.(true);

    // One at a time, so the images arrive in the order they were chosen.
    for (const [index, file] of accepted.entries()) {
      if (!mounted.current) {
        return;
      }

      setProgress({
        name: file.name,
        position: index + 1,
        total: accepted.length,
        percentage: 0,
      });

      try {
        const blob = await uploadPresigned(uploadPathFor(file.name), file, {
          access: 'public',
          handleUploadUrl: UPLOAD_ENDPOINT,
          onUploadProgress: ({ percentage }) => {
            if (mounted.current) {
              setProgress((current) =>
                current ? { ...current, percentage: Math.round(percentage) } : current,
              );
            }
          },
        });

        if (!mounted.current) {
          return;
        }

        commit([...latest.current, blob.url]);
      } catch (error) {
        // Find out why, so the message names the real cause.
        const reason = await explainUploadFailure(error, () =>
          fetch(UPLOAD_ENDPOINT, { cache: 'no-store' }),
        );

        if (!mounted.current) {
          return;
        }

        setProblems((current) => [
          ...current,
          `"${file.name}" could not be uploaded. ${reason}`,
        ]);
      }
    }

    if (mounted.current) {
      setProgress(null);
      uploadsRunning.current = false;
      busyChange.current?.(false);
    }
  }

  function pickFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    // Clearing the field lets the same file be chosen again after a failure.
    event.target.value = '';

    void addFiles(files);
  }

  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!draggedFiles(event)) {
      return;
    }

    // Without this the browser opens the dropped file instead.
    event.preventDefault();

    if (!locked && !full) {
      setDragging(true);
    }
  }

  function dragLeave(event: DragEvent<HTMLDivElement>) {
    const next = event.relatedTarget;

    if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setDragging(false);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    if (!draggedFiles(event)) {
      return;
    }

    event.preventDefault();
    setDragging(false);

    if (disabled) {
      return;
    }

    if (uploading) {
      // Say why the drop was ignored, without hiding messages from the running batch.
      setProblems((current) => [
        ...current,
        'Wait for the current upload to finish, then drop the files again.',
      ]);

      return;
    }

    if (full) {
      setProblems([`A product can have ${maxImages} images. Remove one first.`]);

      return;
    }

    void addFiles(Array.from(event.dataTransfer.files));
  }

  function move(index: number, offset: number) {
    const current = uniqueImages(latest.current);
    const target = index + offset;

    // The first image cannot move earlier, the last cannot move later.
    if (target < 0 || target >= current.length) {
      return;
    }

    commit(moveImage(current, index, offset));
  }

  function remove(index: number) {
    commit(uniqueImages(latest.current).filter((_, position) => position !== index));

    /*
     * The button that had focus is gone. Once the list has re-rendered, put
     * focus on the file field (which reappears when the list was full).
     */
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={helpId}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
      className={`rounded-2xl border p-4 transition-colors ${
        dragging ? 'border-[#4c2a7d] bg-[#f7f4fa]' : 'border-[#e8e2ef] bg-white'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="text-sm font-semibold">
          Product images
        </p>

        <p className="text-xs text-[#6f6679]">
          {shown.length} of {maxImages}
        </p>
      </div>

      {/*
       * Two columns on phones. From 640px up the grid fits as many 7rem
       * tiles as the container allows, so it works both in the 480px
       * product form column and in a full-width form.
       */}
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]">
        {shown.map((url, index) => (
          <li key={url} className="overflow-hidden rounded-xl border border-[#e8e2ef] bg-white">
            <div className="relative aspect-square bg-[#f7f4fa]">
              {/* Plain <img>: admin thumbnails need no optimisation and no remote-host allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Product image ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-2"
              />

              {index === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-[#1f1235] px-2 py-1 text-xs font-semibold text-white">
                  Main image
                </span>
              )}
            </div>

            <div className="flex divide-x divide-[#e8e2ef] border-t border-[#e8e2ef]">
              {/*
               * At either end of the list the arrow is marked aria-disabled
               * instead of disabled. A disabled button drops keyboard focus,
               * so someone moving an image to the front with the keyboard
               * would lose their place on the last press.
               */}
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={disabled}
                aria-disabled={index === 0 || undefined}
                aria-label={`Move image ${index + 1} earlier`}
                title="Move earlier"
                className={tileButton}
              >
                <Icon name="earlier" />
              </button>

              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={disabled}
                aria-disabled={index === shown.length - 1 || undefined}
                aria-label={`Move image ${index + 1} later`}
                title="Move later"
                className={tileButton}
              >
                <Icon name="later" />
              </button>

              <button
                type="button"
                onClick={() => remove(index)}
                disabled={disabled}
                aria-label={`Remove image ${index + 1}`}
                title="Remove"
                className={`${tileButton} hover:text-[#8a1c10]`}
              >
                <Icon name="remove" />
              </button>
            </div>
          </li>
        ))}

        {!full && (
          <li className={shown.length === 0 ? 'col-span-full' : ''}>
            <label
              className={`relative flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#4c2a7d] ${
                shown.length === 0 ? 'min-h-40' : 'aspect-square h-full'
              } ${
                locked
                  ? 'cursor-not-allowed border-[#e8e2ef] bg-[#faf8fc] text-[#b9b1c4]'
                  : 'cursor-pointer border-[#cfc3de] bg-[#faf8fc] text-[#38205f] hover:border-[#4c2a7d] hover:bg-[#f7f4fa]'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                disabled={locked}
                onChange={pickFiles}
                className="sr-only"
              />

              <span className="text-sm font-bold">
                {shown.length === 0 ? 'Add product images' : 'Add images'}
              </span>

              <span className={`text-xs ${locked ? '' : 'text-[#6f6679]'}`}>
                Choose files or drop them here
              </span>
            </label>
          </li>
        )}
      </ul>

      {progress && (
        <div className="mt-4" role="status">
          <p className="truncate text-xs font-semibold text-[#1f1235]">
            Uploading {progress.name} ({progress.position} of {progress.total})
          </p>

          <div aria-hidden="true" className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8e2ef]">
            <div
              className="h-full rounded-full bg-[#4c2a7d] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <ul
          role="alert"
          className="mt-4 space-y-1 rounded-lg border border-[#f0c4bd] bg-[#fef4f2] p-3 text-xs leading-5 text-[#8a1c10]"
        >
          {problems.map((problem, index) => (
            <li key={`${index}-${problem}`}>{problem}</li>
          ))}
        </ul>
      )}

      <p id={helpId} className="mt-4 text-xs leading-5 text-[#6f6679]">
        The first image is the one shoppers see in listings. Use the arrows to change the order.{' '}
        {ALLOWED_IMAGE_TYPES_LABEL}, up to {MAX_IMAGE_MB} MB each.
      </p>
    </div>
  );
}
