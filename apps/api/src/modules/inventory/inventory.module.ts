import {
  AuthModule,
} from '../auth/auth.module';

import {
  forwardRef,
  Module,
} from '@nestjs/common';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  CatalogModule,
} from '../catalog/catalog.module';

import {
  InventoryController,
} from './inventory.controller';

import {
  InventoryService,
} from './inventory.service';

import {
  Inventory,
  InventorySchema,
} from './schemas/inventory.schema';

import {
  StockMovement,
  StockMovementSchema,
} from './schemas/stock-movement.schema';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    CatalogModule,

    MongooseModule.forFeature([
      {
        name: Inventory.name,
        schema: InventorySchema,
      },
      {
        name: StockMovement.name,
        schema:
          StockMovementSchema,
      },
    ]),
  ],

  controllers: [
    InventoryController,
  ],

  providers: [
    InventoryService,
  ],

  exports: [
    InventoryService,
  ],
})
export class InventoryModule {}
