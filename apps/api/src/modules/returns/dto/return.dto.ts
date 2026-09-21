import {
  Type,
} from 'class-transformer';

import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnItemDto {
  @IsString()
  sku!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @IsString()
  orderNumber!: string;

  @IsString()
  phone!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class UpdateReturnStatusDto {
  @IsIn([
    'requested',
    'approved',
    'rejected',
    'received',
    'completed',
  ])
  status!: string;
}
