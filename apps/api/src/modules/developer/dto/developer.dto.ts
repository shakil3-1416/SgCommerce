import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/* Every collection of the Developer API is paged the same way. */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

const asBoolean = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === true || value === 'true';

export class ProductsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** A category id, as returned by GET /categories (its slug). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @Transform(asBoolean)
  @IsBoolean()
  active?: boolean;
}

export class InventoryQueryDto extends PageQueryDto {
  /** One SKU, or several separated by commas. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sku?: string;

  @IsOptional()
  @Transform(asBoolean)
  @IsBoolean()
  low_stock?: boolean;
}

export class CustomersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;
}

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];

export class OrdersQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  payment_status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customer_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsISO8601()
  created_after?: string;

  @IsOptional()
  @IsISO8601()
  created_before?: string;
}

export class PaymentsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  order_id?: string;

  @IsOptional()
  @IsIn(['started', 'paid', 'failed', 'cancelled', 'review'])
  status?: string;
}

export class ReturnsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  order_id?: string;

  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'received', 'completed'])
  status?: string;
}

export class RefundsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  order_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  return_id?: string;

  @IsOptional()
  @IsIn(['pending', 'completed', 'failed'])
  status?: string;
}

/* The rest is used by the admin's Developers pages, not by the Developer API itself. */

export class CreateApiApplicationDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes!: string[];

  /** 0 (never), 30, 90 or 365. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expiresInDays?: number;
}

export class UpdateApiApplicationDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes?: string[];
}

export class RollApiKeyDto {
  /** How long the old key keeps working: 0 (stops at once), 1, 24 or 168 hours. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  graceHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  expiresInDays?: number;
}

export class RequestLogQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  app_id?: string;

  @IsOptional()
  @IsIn(['2xx', '4xx', '5xx'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  request_id?: string;
}
