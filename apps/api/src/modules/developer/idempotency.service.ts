import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiError, describeError } from './api-error';
import { ApiIdempotency, ApiIdempotencyDocument } from './schemas/api-idempotency.schema';

/*
 * If the first request with a key never finished (the server stopped in
 * the middle), another request may take the key over after this long.
 */
const ABANDONED_AFTER_MS = 60_000;

/* Refusals that say "not now" rather than "no": never remembered, so a retry can succeed. */
const NOT_AN_OUTCOME = new Set(['rate_limit_exceeded', 'resource_busy', 'idempotency_in_progress']);

export interface Outcome {
  status: number;
  body: unknown;
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Makes a write safe to repeat.
 *
 * The first request with a key does the work and its answer is kept.
 * A repeat of the same request with the same key gets that answer back
 * without the work being done again. The same key with a different
 * request is refused.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(ApiIdempotency.name)
    private readonly records: Model<ApiIdempotencyDocument>,
  ) {}

  async run(
    appId: string,
    key: string,
    fingerprint: string,
    work: () => Promise<Outcome>,
    onReplay: () => void = () => undefined,
  ): Promise<Outcome> {
    const claimed = await this.claim(appId, key, fingerprint, onReplay);

    if (claimed) {
      return claimed;
    }

    try {
      const outcome = await work();

      await this.records.updateOne(
        { appId, key },
        { $set: { state: 'completed', status: outcome.status, body: outcome.body } },
      );

      return outcome;
    } catch (error) {
      const refusal = describeError(error);
      const decided =
        refusal.status >= 400 && refusal.status < 500 && !NOT_AN_OUTCOME.has(refusal.code);

      if (decided) {
        // A refusal is an outcome too: the same request gets the same refusal.
        await this.records
          .updateOne(
            { appId, key },
            {
              $set: {
                state: 'completed',
                status: refusal.status,
                body: { code: refusal.code, message: refusal.message, details: refusal.details ?? null },
              },
            },
          )
          .catch(() => undefined);
      } else {
        // Nothing was decided. Forget the key so the caller can try again with it.
        await this.records.deleteOne({ appId, key }).catch(() => undefined);
      }

      throw error;
    }
  }

  /**
   * Reserves the key for this request. Returns nothing when the work
   * should go ahead, or the earlier answer when this is a repeat.
   */
  private async claim(
    appId: string,
    key: string,
    fingerprint: string,
    onReplay: () => void,
  ): Promise<Outcome | null> {
    try {
      await this.records.create({ appId, key, fingerprint, state: 'in_progress', startedAt: new Date() });

      return null;
    } catch (error) {
      if (!isDuplicate(error)) {
        throw error;
      }
    }

    const existing = await this.records.findOne({ appId, key }).lean();

    if (!existing) {
      // It expired between the two steps. Rare; the caller simply retries.
      throw new ApiError(409, 'idempotency_in_progress', 'Retry the request in a moment.');
    }

    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(
        409,
        'idempotency_conflict',
        'This Idempotency-Key was already used for a different request. Use a new key for a new request.',
      );
    }

    if (existing.state !== 'completed') {
      const age = Date.now() - new Date(existing.startedAt).getTime();

      if (age < ABANDONED_AFTER_MS) {
        throw new ApiError(
          409,
          'idempotency_in_progress',
          'A request with this Idempotency-Key is still being processed. Retry in a moment.',
        );
      }

      // The first attempt was abandoned. Only one later request may take it over.
      const taken = await this.records
        .findOneAndUpdate(
          // Matching on the old start time means only one of several takers succeeds.
          { appId, key, state: 'in_progress', startedAt: existing.startedAt },
          { $set: { startedAt: new Date() } },
        )
        .lean();

      if (!taken) {
        throw new ApiError(
          409,
          'idempotency_in_progress',
          'A request with this Idempotency-Key is still being processed. Retry in a moment.',
        );
      }

      return null;
    }

    onReplay();

    if (existing.status >= 400) {
      const refusal = (existing.body ?? {}) as { code?: string; message?: string; details?: unknown };

      throw new ApiError(
        existing.status,
        refusal.code ?? 'request_failed',
        refusal.message ?? 'The request failed.',
        refusal.details ?? undefined,
      );
    }

    return { status: existing.status, body: existing.body };
  }
}
