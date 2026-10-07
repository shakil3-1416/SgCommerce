import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mergeMap, Observable } from 'rxjs';

import { ApiRequestLogService } from './api-request-log.service';

/**
 * Records every request the Developer API answers successfully. Requests
 * that are refused or fail are recorded by the exception filter.
 *
 * The line is written before the answer is sent rather than after, so it
 * is not lost on hosting that pauses a function once it has answered.
 */
@Injectable()
export class DeveloperRequestLogInterceptor implements NestInterceptor {
  constructor(
    private readonly log: ApiRequestLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const http = context.switchToHttp();

        const request = http.getRequest();

        /*
         * At this point the framework has not yet set the final status.
         * It will be the route's own code if it declares one, otherwise
         * 201 for a POST and 200 for anything else.
         */
        const declared = this.reflector.get<number | undefined>('__httpCode__', context.getHandler());
        const status =
          typeof declared === 'number' ? declared : request.method === 'POST' ? 201 : 200;

        await this.log.record(request, status, '');

        return body;
      }),
    );
  }
}
