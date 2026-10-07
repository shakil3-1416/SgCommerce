import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';

import { ORDER_STATUSES } from './developer.dto';

/* The bodies of the Developer API's write requests. Field names are snake_case, as in its answers. */

export class CancelOrderDto {
  /** Cancel only if the order is still in this status. */
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  expected_status?: string;
}

export const SETTABLE_ORDER_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];

export class SetOrderStatusDto {
  @IsIn(SETTABLE_ORDER_STATUSES)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tracking_number?: string;

  /** Change only if the order is still in this status. */
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  expected_status?: string;
}

export class ReturnLineDto {
  @IsString()
  @Length(1, 80)
  sku!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;
}

export class CreateReturnBodyDto {
  @IsString()
  @Length(1, 40)
  order_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  items!: ReturnLineDto[];

  @IsString()
  @Length(1, 200)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'received', 'completed'];
export const SETTABLE_RETURN_STATUSES = ['approved', 'rejected', 'received', 'completed'];

export class SetReturnStatusDto {
  @IsIn(SETTABLE_RETURN_STATUSES)
  status!: string;

  /** Change only if the return is still in this status. */
  @IsOptional()
  @IsIn(RETURN_STATUSES)
  expected_status?: string;
}

export class AdjustInventoryBodyDto {
  /** Units to add (positive) or take away (negative). */
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  @Min(-100000)
  @Max(100000)
  delta!: number;

  /** Why, for the stock history: "stock count", "damaged", "supplier delivery". */
  @IsString()
  @Length(2, 80)
  reason!: string;

  /** The caller's own reference, such as a delivery note number. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}
