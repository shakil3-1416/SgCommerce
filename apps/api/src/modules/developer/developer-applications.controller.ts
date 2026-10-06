import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';

import { AuthGuard, RequireRole } from '../auth/auth.guard';
import { ApiApplicationsService } from './api-applications.service';
import { CreateApiApplicationDto } from './dto/developer.dto';

/*
 * For the admin's Developers page: registering applications and
 * switching them off. A signed-in admin only; an application's own
 * credential cannot create or revoke applications.
 */
@Controller('developer-applications')
@UseGuards(AuthGuard)
@RequireRole('admin')
export class DeveloperApplicationsController {
  constructor(private readonly applications: ApiApplicationsService) {}

  @Get()
  overview() {
    return this.applications.overview();
  }

  /** The answer holds the credential in `key`, this once only. */
  @Post()
  create(@Body() dto: CreateApiApplicationDto, @Req() request: any) {
    return this.applications.create(dto, request.user?.email || 'admin');
  }

  @Post(':appId/revoke')
  @HttpCode(200)
  revoke(@Param('appId') appId: string, @Req() request: any) {
    return this.applications.revoke(appId, request.user?.email || 'admin');
  }
}
