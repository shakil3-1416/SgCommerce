import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
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

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export class VariantBodyDto {
  /** Left out, the API generates one from the product code: SGP-000217-01. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsString()
  @Length(1, 160)
  title!: string;

  /** Whole taka. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  compare_at_price?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Units in stock when the variant is created. 0 when left out. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  opening_stock?: number;
}

export class CreateProductBodyDto {
  @IsString()
  @Length(2, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  /** A category id, as returned by GET /categories. */
  @IsString()
  @Length(1, 120)
  category!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => VariantBodyDto)
  variants!: VariantBodyDto[];
}

export class UpdateProductBodyDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateVariantBodyDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000000)
  price?: number;

  /** A number sets it; null removes it. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000000)
  compare_at_price?: number | null;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export class UpdateCustomerBodyDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;
}

export class AddAddressBodyDto {
  /** What the customer calls it: "Home", "Office". */
  @IsString()
  @Length(1, 60)
  label!: string;

  @IsString()
  @Length(1, 200)
  address_line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address_line2?: string;

  /** The district decides the delivery zone. */
  @IsString()
  @Length(1, 80)
  district!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

export const REFUND_STATUSES = ['pending', 'completed', 'failed'];

export class SetRefundStatusDto {
  @IsIn(REFUND_STATUSES)
  status!: string;

  /** For the record: a bank reference, or why it failed. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Change only if the refund is still in this status. */
  @IsOptional()
  @IsIn(REFUND_STATUSES)
  expected_status?: string;
}
