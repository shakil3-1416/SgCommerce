import {
  Global,
  Module,
} from '@nestjs/common';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  Counter,
  CounterSchema,
} from './schemas/counter.schema';

import {
  SequencesService,
} from './sequences.service';

/*
 * Global on purpose, like RedisModule: catalog, orders, returns and
 * refunds can all ask for numbers without importing this module.
 * It is registered once, in AppModule.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Counter.name,
        schema: CounterSchema,
      },
    ]),
  ],

  providers: [
    SequencesService,
  ],

  exports: [
    SequencesService,
  ],
})
export class SequencesModule {}
