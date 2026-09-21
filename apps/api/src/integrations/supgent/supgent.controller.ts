import { Controller, Get } from '@nestjs/common';

import { SupgentService } from './supgent.service';

@Controller('integrations/supgent')
export class SupgentController {
  constructor(
    private readonly supgentService: SupgentService,
  ) {}

  @Get('capabilities')
  getCapabilities() {
    return this.supgentService.getCapabilities();
  }
}
