import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  decodeCursor,
  dhakaDay,
  encodeCursor,
  loggedPath,
  pageSize,
  recentDays,
} from './developer-api';
import {
  ApiRequestLog,
  ApiRequestLogDocument,
  ApiUsage,
  ApiUsageDocument,
} from './schemas/api-request-log.schema';

/* Writing the log may never hold a response up for long. */
const WRITE_BUDGET_MS = 400;

export interface UsageDay {
  day: string;
  requests: number;
  errors: number;
}

export interface UsageSummary {
  today: UsageDay;
  /** The last seven days, oldest first, with a zero for a day without requests. */
  week: UsageDay[];
  weekRequests: number;
  weekErrors: number;
}

function summarise(rows: Array<{ day: string; requests?: number; errors?: number }>, days: string[]): UsageSummary {
  const week = days.map((day) => {
    const row = rows.find((item) => item.day === day);

    return { day, requests: Number(row?.requests ?? 0), errors: Number(row?.errors ?? 0) };
  });

  return {
    today: week[week.length - 1] ?? { day: '', requests: 0, errors: 0 },
    week,
    weekRequests: week.reduce((sum, item) => sum + item.requests, 0),
    weekErrors: week.reduce((sum, item) => sum + item.errors, 0),
  };
}

/**
 * The record of what applications asked for: a line per request, and a
 * count per application per day.
 */
@Injectable()
export class ApiRequestLogService {
  constructor(
    @InjectModel(ApiRequestLog.name)
    private readonly logs: Model<ApiRequestLogDocument>,
    @InjectModel(ApiUsage.name)
    private readonly usage: Model<ApiUsageDocument>,
  ) {}

  /**
   * Records one request. Only requests from a recognised application are
   * recorded: a stranger guessing keys must not be able to fill the log.
   * It never throws and never takes long: a request is not failed, or
   * held up, because its log line could not be written.
   */
  async record(request: any, status: number, code: string): Promise<void> {
    const application = request?.apiApplication;

    if (!application?.appId || request.developerLogged) {
      return;
    }

    request.developerLogged = true;

    const startedAt = Number(request.developerStartedAt ?? Date.now());

    const write = Promise.all([
      this.logs.create({
        requestId: String(request.requestId ?? ''),
        appId: application.appId,
        appName: String(application.name ?? ''),
        method: String(request.method ?? 'GET'),
        path: loggedPath(request.originalUrl ?? request.url),
        status,
        code,
        durationMs: Math.max(0, Date.now() - startedAt),
        ip: String(request.ip ?? '').slice(0, 64),
        userAgent: String(request.headers?.['user-agent'] ?? '').slice(0, 200),
      }),
      this.usage.updateOne(
        { appId: application.appId, day: dhakaDay() },
        { $inc: { requests: 1, errors: status >= 400 ? 1 : 0 } },
        { upsert: true },
      ),
    ]).catch((error) => {
      console.error('[developer-api] request log not written', request.requestId, error);
    });

    await Promise.race([write, new Promise((resolve) => setTimeout(resolve, WRITE_BUDGET_MS))]);
  }

  /** The log, newest first. `status` is '2xx', '4xx' or '5xx'. */
  async list(query: { appId?: string; status?: string; requestId?: string; limit?: number; cursor?: string }) {
    const filter: Record<string, unknown> = {};

    if (query.appId?.trim()) {
      filter.appId = query.appId.trim();
    }

    if (query.requestId?.trim()) {
      filter.requestId = query.requestId.trim();
    }

    if (query.status === '2xx') {
      filter.status = { $gte: 200, $lt: 300 };
    } else if (query.status === '4xx') {
      filter.status = { $gte: 400, $lt: 500 };
    } else if (query.status === '5xx') {
      filter.status = { $gte: 500 };
    }

    const limit = pageSize(query.limit);
    const after = decodeCursor(query.cursor);

    const conditions = after
      ? { $and: [filter, { _id: { $lt: new Types.ObjectId(after) } }] }
      : filter;

    const found: any[] = await (this.logs as Model<any>)
      .find(conditions)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = found.length > limit;
    const rows = hasMore ? found.slice(0, limit) : found;
    const last = rows[rows.length - 1];

    return {
      requests: rows.map((row) => ({
        requestId: row.requestId,
        appId: row.appId,
        appName: row.appName ?? '',
        method: row.method,
        path: row.path,
        status: row.status,
        code: row.code ?? '',
        durationMs: row.durationMs ?? 0,
        ip: row.ip ?? '',
        userAgent: row.userAgent ?? '',
        at: row.createdAt ?? null,
      })),
      hasMore,
      nextCursor: hasMore && last ? encodeCursor(last._id) : null,
    };
  }

  /** Usage of several applications over the last seven days, in one query. */
  async usageFor(appIds: string[]): Promise<Record<string, UsageSummary>> {
    const days = recentDays(7);

    const rows: any[] =
      appIds.length === 0
        ? []
        : await (this.usage as Model<any>).find({ appId: { $in: appIds }, day: { $in: days } }).lean();

    return Object.fromEntries(
      appIds.map((appId) => [appId, summarise(rows.filter((row) => row.appId === appId), days)]),
    );
  }
}
