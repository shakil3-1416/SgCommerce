import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { ApiError, DeveloperExceptionFilter } from './api-error';
import { ApiKeyGuard, RequireScope } from './api-key.guard';
import { idempotencyKeyProblem, loggedPath, requestFingerprint } from './developer-api';
import { DeveloperRequestLogInterceptor } from './developer-request-log.interceptor';
import { DeveloperWriteService, WriteOrigin } from './developer-write.service';
import {
  AdjustInventoryBodyDto,
  CancelOrderDto,
  CreateReturnBodyDto,
  SetOrderStatusDto,
  SetReturnStatusDto,
} from './dto/developer-write.dto';
import { IdempotencyService } from './idempotency.service';

/*
 * The Developer API's writes. Base address: /api/v1/developer
 *
 * Every route needs a write scope and an Idempotency-Key header. The
 * same request sent again with the same key gets the first answer back,
 * marked "Idempotent-Replayed: true", and nothing is done twice.
 */
@Controller('developer')
@UseGuards(ApiKeyGuard)
@UseInterceptors(DeveloperRequestLogInterceptor)
@UseFilters(DeveloperExceptionFilter)
export class DeveloperWriteController {
  constructor(
    private readonly write: DeveloperWriteService,
    private readonly idempotency: IdempotencyService,
  ) {}

  private origin(request: any): WriteOrigin {
    return {
      appId: request.apiApplication.appId,
      appName: request.apiApplication.name,
      requestId: request.requestId,
    };
  }

  private key(request: any): string {
    const header = request.headers?.['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;
    const problem = idempotencyKeyProblem(key);

    if (problem === 'missing') {
      throw new ApiError(
        400,
        'idempotency_key_required',
        'Send an Idempotency-Key header with every write: a value you generate, such as a UUID, and reuse only when retrying the same request.',
      );
    }

    if (problem) {
      throw new ApiError(
        400,
        'invalid_idempotency_key',
        'The Idempotency-Key must be 8 to 255 printable characters without spaces.',
      );
    }

    return key as string;
  }

  /** Runs a write once per key, and answers a repeat with the first answer. */
  private async once(
    request: any,
    response: any,
    body: unknown,
    status: number,
    work: (key: string) => Promise<unknown>,
  ): Promise<unknown> {
    const key = this.key(request);

    const outcome = await this.idempotency.run(
      request.apiApplication.appId,
      key,
      requestFingerprint(request.method, loggedPath(request.originalUrl ?? request.url), body),
      async () => ({ status, body: await work(key) }),
      () => response.setHeader('Idempotent-Replayed', 'true'),
    );

    return outcome.body;
  }

  /* Orders */

  @RequireScope('orders:write')
  @Post('orders/:orderNumber/cancel')
  @HttpCode(200)
  cancelOrder(
    @Param('orderNumber') orderNumber: string,
    @Body() body: CancelOrderDto,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return this.once(request, response, body, 200, () =>
      this.write.cancelOrder(orderNumber, body, this.origin(request)),
    );
  }

  @RequireScope('orders:write')
  @Post('orders/:orderNumber/status')
  @HttpCode(200)
  setOrderStatus(
    @Param('orderNumber') orderNumber: string,
    @Body() body: SetOrderStatusDto,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return this.once(request, response, body, 200, () =>
      this.write.setOrderStatus(orderNumber, body, this.origin(request)),
    );
  }

  /* Returns */

  @RequireScope('returns:write')
  @Post('returns')
  createReturn(
    @Body() body: CreateReturnBodyDto,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return this.once(request, response, body, 201, () => this.write.createReturn(body));
  }

  @RequireScope('returns:write')
  @Post('returns/:returnNumber/status')
  @HttpCode(200)
  setReturnStatus(
    @Param('returnNumber') returnNumber: string,
    @Body() body: SetReturnStatusDto,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return this.once(request, response, body, 200, () =>
      this.write.setReturnStatus(returnNumber, body),
    );
  }

  /* Inventory */

  @RequireScope('inventory:write')
  @Post('inventory/:sku/adjustments')
  @HttpCode(200)
  adjustInventory(
    @Param('sku') sku: string,
    @Body() body: AdjustInventoryBodyDto,
    @Req() request: any,
    @Res({ passthrough: true }) response: any,
  ) {
    return this.once(request, response, body, 200, (key) =>
      this.write.adjustInventory(sku, body, this.origin(request), key),
    );
  }
}
