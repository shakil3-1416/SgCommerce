import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RedisService } from '../../infrastructure/redis/redis.service';
import { ApiError } from './api-error';
import { ApiApplicationsService } from './api-applications.service';
import { newRequestId, RATE_WINDOW_SECONDS, READ_RATE_LIMIT, readBearer } from './developer-api';

export const REQUIRED_SCOPE = 'sgcommerce_developer_scope';

/**
 * Names the scope a credential needs for a route. A route of the
 * Developer API without it can be called by any valid credential, which
 * is right only for "who am I".
 */
export const RequireScope = (scope: string) => SetMetadata(REQUIRED_SCOPE, scope);

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

    await this.count(application.appId, response);

    return true;
  }

  private async count(appId: string, response: any): Promise<void> {
    let limit: { allowed: boolean; remaining: number; retryAfter: number };

    try {
      limit = await this.redis.rateLimit('developer-api', appId, READ_RATE_LIMIT, RATE_WINDOW_SECONDS);
    } catch {
      /*
       * The limiter is unavailable. The request is allowed, as the
       * global limiter in main.ts does in the same situation.
       */
      return;
    }

    response.setHeader('RateLimit-Limit', String(READ_RATE_LIMIT));
    response.setHeader('RateLimit-Remaining', String(limit.remaining));
    response.setHeader('RateLimit-Reset', String(limit.retryAfter));

    if (!limit.allowed) {
      response.setHeader('Retry-After', String(limit.retryAfter));

      throw new ApiError(
        429,
        'rate_limit_exceeded',
        `This application may make ${READ_RATE_LIMIT} requests per minute. Try again in ${limit.retryAfter} seconds.`,
      );
    }
  }
}
