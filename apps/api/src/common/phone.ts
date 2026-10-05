/**
 * One stored format for phone numbers.
 *
 * The shop recognises a customer by phone number, and an order is tracked
 * by order number plus phone. The same number must therefore always be
 * stored the same way. A Bangladesh mobile number is stored as
 * 01XXXXXXXXX (11 digits) however it was typed:
 *
 *   "+880 1711-000001"   ->  "01711000001"
 *   "8801711000001"      ->  "01711000001"
 *   "01711 000 001"      ->  "01711000001"
 *   "০১৭১১০০০০০১"        ->  "01711000001"
 *
 * A value that is not a Bangladesh mobile number is returned as it always
 * was (trimmed, spaces removed), so no number that used to be accepted is
 * refused now.
 *
 * Pure function: used by the API and by backfill-business-ids.ts.
 */

const BD_MOBILE = /^01[3-9]\d{8}$/;

const BENGALI_ZERO = 0x09e6;

export function normalizePhone(value: string): string {
  const unchanged = value.trim().replace(/\s+/g, '');

  let digits = unchanged
    .replace(/[\u09e6-\u09ef]/g, (digit) => String(digit.charCodeAt(0) - BENGALI_ZERO))
    .replace(/[-().]/g, '');

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (!/^\d+$/.test(digits)) {
    return unchanged;
  }

  // Country code, with or without the 0 that some people keep after it.
  if (digits.startsWith('880')) {
    digits = digits.slice(3);
  }

  // "1711000001": the leading 0 was left off.
  if (digits.length === 10 && digits.startsWith('1')) {
    digits = `0${digits}`;
  }

  return BD_MOBILE.test(digits) ? digits : unchanged;
}

/** True when the value is already in the stored format, or is not a Bangladesh mobile number at all. */
export function isStoredPhoneFormat(value: string): boolean {
  return normalizePhone(value) === value;
}

export interface PhoneDoc {
  id: string;
  phone: unknown;
}

export interface PhoneChange {
  id: string;
  from: string;
  to: string;
}

export interface PhonePlan {
  /** Records whose phone will be rewritten in the stored format. */
  updates: PhoneChange[];
  /**
   * Records left alone because another record already has the same number
   * in the stored format. Only possible where the phone must be unique.
   * These need a person to decide which record to keep.
   */
  conflicts: PhoneChange[];
}

/**
 * Works out which stored phone numbers need rewriting. Where `unique` is
 * true (customers, users), two records must never end up with the same
 * number: the first keeps it and the others are reported as conflicts.
 * Running it again on its own output plans nothing.
 */
export function planPhoneUpdates(docs: readonly PhoneDoc[], unique: boolean): PhonePlan {
  const taken = new Set<string>();

  for (const doc of docs) {
    if (typeof doc.phone === 'string' && isStoredPhoneFormat(doc.phone)) {
      taken.add(doc.phone);
    }
  }

  const updates: PhoneChange[] = [];
  const conflicts: PhoneChange[] = [];

  for (const doc of docs) {
    if (typeof doc.phone !== 'string' || isStoredPhoneFormat(doc.phone)) {
      continue;
    }

    const change = { id: doc.id, from: doc.phone, to: normalizePhone(doc.phone) };

    if (unique && taken.has(change.to)) {
      conflicts.push(change);
      continue;
    }

    if (unique) {
      taken.add(change.to);
    }

    updates.push(change);
  }

  return { updates, conflicts };
}

export interface CustomerPhoneDoc {
  id: string;
  phone: unknown;
  /** True when a user account (a sign-in) is linked to this customer record. */
  hasAccount: boolean;
}

export interface CustomerMerge {
  /** The number, in the stored format, that these records share. */
  phone: string;
  /** The record that stays. Orders and saved addresses of the others move to it. */
  keepId: string;
  /** The phone the kept record holds now; rewritten to `phone` once the duplicates are gone. */
  keepPhone: string;
  /** Duplicate records of the same customer. Removed after their orders have moved. */
  removeIds: string[];
}

export interface CustomerPhonePlan {
  /** Customers stored once: only the format of the number changes. */
  rewrites: PhoneChange[];
  /** Customers stored more than once under different spellings of one number. */
  merges: CustomerMerge[];
  /**
   * Numbers shared by two or more customers who each have their own account.
   * A program cannot tell which sign-in should win, so these are left alone.
   */
  blocked: Array<{ phone: string; ids: string[] }>;
}

/**
 * Plans the clean-up of customer phone numbers. A customer is identified
 * by phone, so two records whose numbers are the same once written in the
 * stored format are the same customer saved twice (typed once with +880
 * and once with 0). They are merged into one record:
 *
 *   - the record with a user account is kept, because a sign-in points at it;
 *   - otherwise the record already in the stored format is kept;
 *   - otherwise the first one given (pass the records oldest-first).
 *
 * Running it again on its own result plans nothing.
 */
export function planCustomerPhones(docs: readonly CustomerPhoneDoc[]): CustomerPhonePlan {
  const groups = new Map<string, Array<CustomerPhoneDoc & { phone: string }>>();

  for (const doc of docs) {
    if (typeof doc.phone !== 'string') {
      continue;
    }

    const stored = normalizePhone(doc.phone);
    const group = groups.get(stored) ?? [];

    group.push({ ...doc, phone: doc.phone });
    groups.set(stored, group);
  }

  const plan: CustomerPhonePlan = { rewrites: [], merges: [], blocked: [] };

  for (const [phone, members] of groups) {
    const [only] = members;

    if (members.length === 1 && only) {
      if (only.phone !== phone) {
        plan.rewrites.push({ id: only.id, from: only.phone, to: phone });
      }

      continue;
    }

    const withAccount = members.filter((member) => member.hasAccount);

    if (withAccount.length > 1) {
      plan.blocked.push({ phone, ids: members.map((member) => member.id) });
      continue;
    }

    const keep =
      withAccount[0] ?? members.find((member) => member.phone === phone) ?? members[0];

    if (!keep) {
      continue;
    }

    plan.merges.push({
      phone,
      keepId: keep.id,
      keepPhone: keep.phone,
      removeIds: members.filter((member) => member.id !== keep.id).map((member) => member.id),
    });
  }

  return plan;
}

/** "01711000001" -> "0171•••0001": enough to recognise a number in a log without printing it in full. */
export function maskPhone(value: string): string {
  if (value.length <= 7) {
    return value;
  }

  return `${value.slice(0, 4)}${'\u2022'.repeat(value.length - 8)}${value.slice(-4)}`;
}
