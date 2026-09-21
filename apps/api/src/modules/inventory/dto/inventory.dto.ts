import {
  Transform,
  Type,
} from 'class-transformer';

import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertInventoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  onHand!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reserved?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderLevel?: number;
}

export class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  delta!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) {
      return undefined;
    }

    return (
      value === true ||
      value === 'true'
    );
  })
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
