import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
  constructor(private readonly log: ApiRequestLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const http = context.switchToHttp();

        await this.log.record(http.getRequest(), Number(http.getResponse()?.statusCode ?? 200), '');

        return body;
      }),
    );
  }
}
