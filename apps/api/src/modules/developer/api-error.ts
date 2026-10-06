import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

import { newRequestId } from './developer-api';

/*
 * Errors of the Developer API.
 *
 * Every error has a machine-readable code, a sentence for a person and
 * the id of the request, in one shape:
 *
 *   { "error": { "code": "order_not_found", "message": "...", "request_id": "req_..." } }
 *
 * A program reads `code`; `message` is for whoever is debugging it.
 * The HTTP status says what kind of failure it was.
 */

export class ApiError extends HttpException {
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super({ code, message }, status);
    this.code = code;
    this.details = details;
  }
}

export interface ErrorDescription {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/* The code for a failure that did not come with one of its own. */
const CODE_BY_STATUS: Record<number, string> = {
  400: 'invalid_request',
  401: 'authentication_required',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  422: 'validation_failed',
  429: 'rate_limit_exceeded',
  502: 'dependency_unavailable',
  503: 'service_unavailable',
};

/**
 * Turns anything that was thrown into the error a client receives.
 * Whatever went wrong inside, the client never sees a stack trace or an
 * internal message: an unexpected failure is "internal_error".
 */
export function describeError(exception: unknown): ErrorDescription {
  if (exception instanceof ApiError) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      ...(exception.details === undefined ? {} : { details: exception.details }),
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const reported =
      typeof body === 'object' && body !== null
        ? (body as { message?: unknown }).message
        : body;

    /*
     * The request validator reports a list of problems with status 400.
     * A request that is well-formed but not acceptable is 422.
     */
    if (status === 400 && Array.isArray(reported)) {
      return {
        status: 422,
        code: 'validation_failed',
        message: 'One or more parameters are not valid.',
        details: reported.map((item) => String(item)),
      };
    }

    if (status >= 500) {
      return {
        status,
        code: CODE_BY_STATUS[status] ?? 'internal_error',
        message: 'The request could not be completed. Try again shortly.',
      };
    }

    return {
      status,
      code: CODE_BY_STATUS[status] ?? 'request_failed',
      message: typeof reported === 'string' && reported !== '' ? reported : 'The request failed.',
    };
  }

  return {
    status: 500,
    code: 'internal_error',
    message: 'Something went wrong on our side. Quote the request id if you report it.',
  };
}

/**
 * Applied to the Developer API's controllers. It also catches what the
 * credential guard throws, so a refused credential gets the same shape
 * as every other error.
 */
@Catch()
export class DeveloperExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const error = describeError(exception);
    const requestId: string = request.requestId ?? newRequestId();

    if (error.status >= 500) {
      // The detail stays in the server's log, findable by the request id.
      console.error('[developer-api]', requestId, request.method, request.originalUrl, exception);
    }

    response.setHeader('X-Request-ID', requestId);

    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        request_id: requestId,
      },
    });
  }
}
