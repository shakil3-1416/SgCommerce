import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
  RequireRole,
} from '../auth/auth.guard';

import {
  AdjustStockDto,
  InventoryQueryDto,
  UpsertInventoryDto,
} from './dto/inventory.dto';

import {
  InventoryService,
} from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory:
      InventoryService,
  ) {}

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Get()
  list(
    @Query()
    query:
      InventoryQueryDto,
  ) {
    return this.inventory
      .list(query);
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Get(':sku/movements')
  movements(
    @Param('sku')
    sku: string,
  ) {
    return this.inventory
      .movements(sku);
  }

  @Get(':sku')
  get(
    @Param('sku')
    sku: string,
  ) {
    return this.inventory
      .get(sku);
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Put(':sku')
  upsert(
    @Param('sku')
    sku: string,

    @Body()
    dto:
      UpsertInventoryDto,
  ) {
    return this.inventory
      .upsert(
        sku,
        dto,
      );
  }

  @UseGuards(AuthGuard)
  @RequireRole('admin')
  @Patch(':sku/adjust')
  adjust(
    @Param('sku')
    sku: string,

    @Body()
    dto:
      AdjustStockDto,
  ) {
    return this.inventory
      .adjust(
        sku,
        dto,
      );
  }
}
