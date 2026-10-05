/**
 * Rules for product image uploads, shared by the upload endpoint (server)
 * and the uploader component (browser) so the two can never disagree.
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

export const ALLOWED_IMAGE_TYPES_LABEL = 'JPG, PNG, WebP or AVIF';

export const MAX_IMAGE_MB = 8;

export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export const MAX_PRODUCT_IMAGES = 8;

/** Route handler that issues upload tokens: src/app/api/uploads/product-image/route.ts */
export const UPLOAD_ENDPOINT = '/api/uploads/product-image';

const UPLOAD_FOLDER = 'products';

const UPLOAD_PATH_PATTERN = /^products\/[a-z0-9][a-z0-9-]{0,59}(\.[a-z0-9]{1,5})?$/;

export function isAllowedImageType(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Storage path for an uploaded file: "My Photo (1).JPG" -> "products/my-photo-1.jpg".
 * The storage service appends a random suffix, so two files with the same
 * name never overwrite each other.
 */
export function uploadPathFor(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const rawBase = dot > 0 ? fileName.slice(0, dot) : fileName;
  const rawExtension = dot > 0 ? fileName.slice(dot + 1) : '';

  const base =
    rawBase
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '') || 'image';

  const extension = rawExtension.toLowerCase();
  const suffix = /^[a-z0-9]{1,5}$/.test(extension) ? `.${extension}` : '';

  return `${UPLOAD_FOLDER}/${base}${suffix}`;
}

/** The endpoint only issues tokens for paths produced by `uploadPathFor`. */
export function isAllowedUploadPath(pathname: string): boolean {
  return UPLOAD_PATH_PATTERN.test(pathname);
}

/** 9858423 -> "9.4 MB" */
export function describeBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Removes blanks and repeats while keeping the first occurrence and the order. */
export function uniqueImages(images: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const image of images) {
    const url = image.trim();

    if (url !== '' && !seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  return result;
}

/** Moves one entry by `offset` positions. Returns the same order when the move is not possible. */
export function moveImage(images: readonly string[], index: number, offset: number): string[] {
  const target = index + offset;
  const next = [...images];

  if (index < 0 || index >= next.length || target < 0 || target >= next.length) {
    return next;
  }

  const moved = next[index];

  if (moved === undefined) {
    return next;
  }

  next.splice(index, 1);
  next.splice(target, 0, moved);

  return next;
}
