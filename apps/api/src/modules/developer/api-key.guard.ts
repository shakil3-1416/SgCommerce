import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RedisService } from '../../infrastructure/redis/redis.service';
import { ApiError } from './api-error';
import { ApiApplicationsService } from './api-applications.service';
import { LocalWindowLimiter, whenSharedLimiterDown } from './rate-limit-fallback';
import {
  newRequestId,
  RATE_WINDOW_SECONDS,
  READ_RATE_LIMIT,
  readBearer,
  WRITE_RATE_LIMIT,
} from './developer-api';

export const REQUIRED_SCOPE = 'sgcommerce_developer_scope';

/**
 * Names the scope a credential needs for a route. A route of the
 * Developer API without it can be called by any valid credential, which
 * is right only for "who am I".
 */
export const RequireScope = (scope: string) => SetMetadata(REQUIRED_SCOPE, scope);

/** Per-instance window used only while the shared limiter is unreachable. */
const localWindow = new LocalWindowLimiter();

/**
 * Guards every route of the Developer API. In order: give the request an
 * id, recognise the credential, check the scope, count the request
 * against the application's limit.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly applications: ApiApplicationsService,
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    // First, so that even a refused request can be quoted and found.
    request.requestId = newRequestId();
    request.developerStartedAt = Date.now();
    response.setHeader('X-Request-ID', request.requestId);

    const presented = readBearer(request.headers?.authorization);

    if (!presented) {
      throw new ApiError(
        401,
        'authentication_required',
        'Send your API key in the Authorization header: "Authorization: Bearer sg_live_...".',
      );
    }

    const application = await this.applications.authenticate(presented);

    request.apiApplication = application;

    const scope = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (scope && !application.scopes.includes(scope)) {
      throw new ApiError(403, 'insufficient_scope', `This API key does not have the "${scope}" scope.`, {
        required_scope: scope,
      });
    }

    await this.count(application.appId, response, String(request.method ?? 'GET').toUpperCase() !== 'GET');

    return true;
  }

  /*
   * Reads and writes have separate allowances, so a busy report cannot
   * use up the room an order update needs, and the reverse.
   */
  private async count(appId: string, response: any, write: boolean): Promise<void> {
    const allowance = write ? WRITE_RATE_LIMIT : READ_RATE_LIMIT;
    let limit: { allowed: boolean; remaining: number; retryAfter: number };

    try {
      limit = await this.redis.rateLimit(
        write ? 'developer-api-write' : 'developer-api',
        appId,
        allowance,
        RATE_WINDOW_SECONDS,
      );
    } catch {
      // The shared limiter is unreachable: never "no limit" (see rate-limit-fallback.ts).
      const policy = whenSharedLimiterDown(write);

      if (policy.kind === 'refuse') {
        response.setHeader('Retry-After', String(policy.retryAfter));
        throw new ApiError(
          503,
          'rate_limiter_unavailable',
          `Write requests are paused while rate limiting is unavailable. Try again in ${policy.retryAfter} seconds.`,
        );
      }

      limit = localWindow.hit(`${write ? 'w' : 'r'}:${appId}`, allowance, RATE_WINDOW_SECONDS);
      response.setHeader('RateLimit-Policy', 'degraded');
    }

    response.setHeader('RateLimit-Limit', String(allowance));
    response.setHeader('RateLimit-Remaining', String(limit.remaining));
    response.setHeader('RateLimit-Reset', String(limit.retryAfter));

    if (!limit.allowed) {
      response.setHeader('Retry-After', String(limit.retryAfter));

      throw new ApiError(
        429,
        'rate_limit_exceeded',
        `This application may make ${allowance} ${write ? 'write' : 'read'} requests per minute. Try again in ${limit.retryAfter} seconds.`,
      );
    }
  }
}
