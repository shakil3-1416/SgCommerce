import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type { ClientSession, Model } from 'mongoose';

import { formatCode, type SequenceName } from './business-ids';
import { Counter } from './schemas/counter.schema';

const MAX_RESERVATION = 10_000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Issues the numbers behind product codes, order numbers and the other
 * business identifiers.
 *
 * Each call is a single atomic `$inc` on one counter document, so two
 * requests can never receive the same number, whether they run in the same
 * process, in different containers or in different serverless invocations.
 *
 * Gaps: without a session the number is consumed even if the caller's own
 * write fails afterwards, which leaves a gap. That is fine for product codes
 * and order numbers. Pass the session of a MongoDB transaction only where
 * numbers must be gapless (for example tax invoices): the increment then
 * rolls back with the transaction, at the price of concurrent callers
 * queueing on the counter document.
 */
@Injectable()
export class SequencesService {
  constructor(
    @InjectModel(Counter.name)
    private readonly counters: Model<Counter>,
  ) {}

  /** Next number in a sequence. */
  async next(name: SequenceName, session?: ClientSession): Promise<number> {
    return this.increment(name, 1, session);
  }

  /** Next formatted code: `nextCode('product')` returns something like "SGP-000217". */
  async nextCode(name: SequenceName, session?: ClientSession): Promise<string> {
    return formatCode(name, await this.next(name, session));
  }

  /**
   * Reserves `count` consecutive numbers in one round trip and returns them
   * in ascending order. Use for bulk imports instead of calling `next` in a loop.
   */
  async reserve(name: SequenceName, count: number, session?: ClientSession): Promise<number[]> {
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_RESERVATION) {
      throw new RangeError(
        `Can reserve between 1 and ${MAX_RESERVATION} numbers at a time, received ${count}`,
      );
    }

    const last = await this.increment(name, count, session);
    const first = last - count + 1;

    return Array.from({ length: count }, (_, index) => first + index);
  }

  /**
   * Moves a counter forward so that it is at least `value`. Never moves it
   * backwards, so it is safe to call from migrations more than once.
   */
  async ensureAtLeast(name: SequenceName, value: number): Promise<void> {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`Counter floor must be a whole number of 0 or more, received ${value}`);
    }

    const run = () =>
      this.counters.updateOne({ _id: name }, { $max: { seq: value } }, { upsert: true }).exec();

    try {
      await run();
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      await run();
    }
  }

  /** Last number issued, or 0 when the sequence has never been used. For display only. */
  async current(name: SequenceName): Promise<number> {
    const counter = await this.counters.findById(name).lean().exec();

    return counter?.seq ?? 0;
  }

  private async increment(
    name: SequenceName,
    by: number,
    session?: ClientSession,
  ): Promise<number> {
    const run = async (): Promise<number> => {
      const counter = await this.counters
        .findOneAndUpdate(
          { _id: name },
          { $inc: { seq: by } },
          { new: true, upsert: true, ...(session ? { session } : {}) },
        )
        .lean()
        .exec();

      if (!counter) {
        throw new Error(`Counter "${name}" could not be updated`);
      }

      return counter.seq;
    };

    try {
      return await run();
    } catch (error) {
      /*
       * Two requests racing to create a counter that does not exist yet:
       * one inserts, the other gets a duplicate-key error and simply tries
       * again. Counters seeded by backfill-business-ids.ts never hit this.
       * Inside a transaction the error has already aborted the transaction,
       * so it is left to the caller's transaction retry.
       */
      if (session || !isDuplicateKeyError(error)) {
        throw error;
      }

      return run();
    }
  }
}
