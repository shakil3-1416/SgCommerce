import { Module } from '@nestjs/common';

import { SupgentController } from './supgent.controller';
import { SupgentService } from './supgent.service';

@Module({
  controllers: [SupgentController],
  providers: [SupgentService],
  exports: [SupgentService],
})
export class SupgentModule {}
