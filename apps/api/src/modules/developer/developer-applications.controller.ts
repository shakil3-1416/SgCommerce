import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AuthGuard, RequireRole } from '../auth/auth.guard';
import { ApiApplicationsService } from './api-applications.service';
import { ApiRequestLogService } from './api-request-log.service';
import { developerReference } from './developer-reference';
import {
  CreateApiApplicationDto,
  RequestLogQueryDto,
  RollApiKeyDto,
  UpdateApiApplicationDto,
} from './dto/developer.dto';

/*
 * For the admin's Developers pages: registering applications, changing
 * and replacing their keys, switching them off, and reading what they
 * did. A signed-in admin only; an application's own key cannot manage
 * applications.
 */
@Controller('developer-applications')
@UseGuards(AuthGuard)
@RequireRole('admin')
export class DeveloperApplicationsController {
  constructor(
    private readonly applications: ApiApplicationsService,
    private readonly log: ApiRequestLogService,
  ) {}

  private actor(request: any): string {
    return request.user?.email || 'admin';
  }

  @Get()
  overview() {
    return this.applications.overview();
  }

  /* The two fixed paths come before ":appId", or they would be read as an application id. */

  /** What applications asked for, newest first. */
  @Get('requests')
  requests(@Query() query: RequestLogQueryDto) {
    return this.log.list({
      appId: query.app_id,
      status: query.status,
      requestId: query.request_id,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  /** The API described as data, for the reference page. */
  @Get('reference')
  reference() {
    return developerReference();
  }

  @Get(':appId')
  detail(@Param('appId') appId: string) {
    return this.applications.detail(appId);
  }

  /** The answer holds the key in `key`, this once only. */
  @Post()
  create(@Body() dto: CreateApiApplicationDto, @Req() request: any) {
    return this.applications.create(dto, this.actor(request));
  }

  @Patch(':appId')
  update(@Param('appId') appId: string, @Body() dto: UpdateApiApplicationDto, @Req() request: any) {
    return this.applications.update(appId, dto, this.actor(request));
  }

  /** Replaces the key. The answer holds the new key, this once only. */
  @Post(':appId/roll')
  @HttpCode(200)
  roll(@Param('appId') appId: string, @Body() dto: RollApiKeyDto, @Req() request: any) {
    return this.applications.roll(appId, dto, this.actor(request));
  }

  @Post(':appId/revoke')
  @HttpCode(200)
  revoke(@Param('appId') appId: string, @Req() request: any) {
    return this.applications.revoke(appId, this.actor(request));
  }
}
