/**
 * Business identifiers for SgCommerce.
 *
 * MongoDB's `_id` stays the internal primary key. The identifiers in this
 * file are the ones people use: printed on invoices, read out on the phone,
 * typed into the admin search box. They are short, sequential, unique, and
 * never change once issued.
 *
 * Everything here is a pure function (no database, no framework), so the
 * formats can be unit-tested and reused by the API and by one-off scripts.
 */

/**
 * One entry per numbered record type. To rename a prefix, change it here
 * before the first code is issued; issued codes must never be rewritten.
 * `width` is the minimum number of digits. Numbers simply grow past it.
 */
export const SEQUENCES = {
  product: { prefix: 'SGP', width: 6 },
  order: { prefix: 'SGO', width: 7 },
  return: { prefix: 'SGR', width: 6 },
  refund: { prefix: 'SGF', width: 6 },
} as const;

export type SequenceName = keyof typeof SEQUENCES;

export function isSequenceName(value: string): value is SequenceName {
  return Object.prototype.hasOwnProperty.call(SEQUENCES, value);
}

/** 217 -> "SGP-000217" */
export function formatCode(name: SequenceName, value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(
      `Sequence value for "${name}" must be a positive whole number, received ${value}`,
    );
  }

  const { prefix, width } = SEQUENCES[name];

  return `${prefix}-${String(value).padStart(width, '0')}`;
}

/** "SGP-000217" -> 217. Returns null for anything that is not a code of this type. */
export function parseCode(name: SequenceName, code: unknown): number | null {
  if (typeof code !== 'string') {
    return null;
  }

  const { prefix } = SEQUENCES[name];
  const match = new RegExp(`^${prefix}-(\\d{1,15})$`).exec(code.trim().toUpperCase());

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

const MAX_SLUG_LENGTH = 80;

/**
 * URL slug from a product or category name.
 *
 * Returns an empty string when nothing usable is left (for example a name
 * written entirely in Bangla script). Callers must fall back to the product
 * code in that case.
 */
export function slugify(input: string): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '') // accents: "Crème" -> "Creme"
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2018\u2019\u02BC`]/g, '') // "women's" -> "womens", not "women-s"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (cleaned.length <= MAX_SLUG_LENGTH) {
    return cleaned;
  }

  const cut = cleaned.slice(0, MAX_SLUG_LENGTH);
  const lastHyphen = cut.lastIndexOf('-');
  const cutsThroughAWord = cleaned[MAX_SLUG_LENGTH] !== '-';

  const trimmed =
    cutsThroughAWord && lastHyphen > MAX_SLUG_LENGTH / 2 ? cut.slice(0, lastHyphen) : cut;

  return trimmed.replace(/-+$/g, '');
}

const SKU_PATTERN = /^[A-Z0-9](?:[A-Z0-9._-]{0,62}[A-Z0-9])?$/;

/** Upper-case, trimmed, inner whitespace turned into hyphens. */
export function normalizeSku(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '-');
}

/** 1 to 64 characters: letters, digits, dot, hyphen, underscore; starts and ends with a letter or digit. */
export function isValidSku(sku: string): boolean {
  return SKU_PATTERN.test(sku);
}

/** ("SGP-000217", 2) -> "SGP-000217-02" */
export function variantSku(productCode: string, position: number): string {
  if (!Number.isSafeInteger(position) || position < 1) {
    throw new RangeError(`Variant position must be a positive whole number, received ${position}`);
  }

  return `${productCode}-${String(position).padStart(2, '0')}`;
}

/** Highest variant position already issued under a product code, or 0 when there is none. */
export function lastVariantPosition(productCode: string, skus: Iterable<string>): number {
  const prefix = `${productCode}-`;
  let last = 0;

  for (const sku of skus) {
    if (!sku.startsWith(prefix)) {
      continue;
    }

    const tail = sku.slice(prefix.length);

    if (/^\d{2,6}$/.test(tail)) {
      last = Math.max(last, Number(tail));
    }
  }

  return last;
}

export interface VariantSkuInput {
  sku?: string | null;
}

/**
 * The SKUs the merchant typed, normalised, in variant order; `null` where
 * the field was left blank. Throws when a typed SKU is malformed or appears
 * on two variants. Needs no product code, so it can run before a number is
 * consumed.
 */
export function typedSkus(variants: readonly VariantSkuInput[]): Array<string | null> {
  const seen = new Set<string>();

  return variants.map((variant) => {
    if (typeof variant.sku !== 'string' || variant.sku.trim() === '') {
      return null;
    }

    const sku = normalizeSku(variant.sku);

    if (!isValidSku(sku)) {
      throw new Error(
        `SKU "${sku}" is not valid. Use 1 to 64 letters, digits, dots, hyphens or underscores, starting and ending with a letter or digit.`,
      );
    }

    if (seen.has(sku)) {
      throw new Error(`SKU "${sku}" is used by more than one variant.`);
    }

    seen.add(sku);

    return sku;
  });
}

/**
 * Returns one SKU per variant, in the same order as `variants`.
 *
 * - A SKU the merchant typed is kept (normalised), so manufacturer SKUs work.
 * - A missing SKU becomes <productCode>-01, -02, ... continuing after the
 *   highest number this product has ever used. That number is the larger of
 *   `lastIssued` (the high-water mark stored on the product) and the highest
 *   number found in `usedSkus` and in the typed SKUs. A SKU that appears on
 *   an old order is therefore never handed to a different item, even after
 *   the variant that carried it was deleted.
 *
 * Throws when a typed SKU is malformed or appears on two variants.
 */
export function assignVariantSkus(
  productCode: string,
  variants: readonly VariantSkuInput[],
  usedSkus: readonly string[] = [],
  lastIssued = 0,
): string[] {
  if (!Number.isSafeInteger(lastIssued) || lastIssued < 0) {
    throw new RangeError(`lastIssued must be a whole number of 0 or more, received ${lastIssued}`);
  }

  const supplied = typedSkus(variants);
  const taken = supplied.filter((sku): sku is string => sku !== null);

  let position = Math.max(lastIssued, lastVariantPosition(productCode, [...usedSkus, ...taken]));

  return supplied.map((sku) => {
    if (sku !== null) {
      return sku;
    }

    position += 1;

    return variantSku(productCode, position);
  });
}

export interface BackfillDoc {
  id: string;
  code?: string | null;
}

export interface BackfillPlan {
  /** Records that will receive a new code, in the order given. */
  assignments: Array<{ id: string; code: string }>;
  /** Records that already carry a valid code and are left alone. */
  alreadyCoded: number;
  /** Records carrying a value that is not a code of this type. Left alone; review by hand. */
  unrecognised: string[];
  /** Value the counter must be at (or above) once the plan is applied. */
  lastValue: number;
}

/**
 * Works out which existing records need a code. Pass records oldest-first so
 * the oldest record gets the lowest number. Running it again on its own
 * output plans nothing, so the backfill is safe to repeat.
 *
 * `startAfter` is the current value of the counter, if one exists. New codes
 * start above both it and the highest code found on a record, so the number
 * of a deleted record is never issued a second time.
 */
export function planCodeBackfill(
  name: SequenceName,
  docs: readonly BackfillDoc[],
  startAfter = 0,
): BackfillPlan {
  if (!Number.isSafeInteger(startAfter) || startAfter < 0) {
    throw new RangeError(`startAfter must be a whole number of 0 or more, received ${startAfter}`);
  }

  let lastValue = startAfter;
  let alreadyCoded = 0;
  const unrecognised: string[] = [];
  const pending: string[] = [];

  for (const doc of docs) {
    const isBlank = doc.code === undefined || doc.code === null || doc.code === '';

    if (isBlank) {
      pending.push(doc.id);
      continue;
    }

    const value = parseCode(name, doc.code);

    if (value === null) {
      unrecognised.push(doc.id);
      continue;
    }

    alreadyCoded += 1;
    lastValue = Math.max(lastValue, value);
  }

  const assignments = pending.map((id) => {
    lastValue += 1;

    return { id, code: formatCode(name, lastValue) };
  });

  return { assignments, alreadyCoded, unrecognised, lastValue };
}
