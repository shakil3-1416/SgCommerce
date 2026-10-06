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
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  CheckoutCustomerDto,
} from '../../customers/dto/customer.dto';

export class CheckoutItemDto {
  @IsString()
  sku!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ShippingAddressDto {
  @IsString()
  @Length(3, 250)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @Length(2, 100)
  city!: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  /*
   * Accepted for older pages, but ignored: the server decides the
   * zone from the district (city).
   */
  @IsOptional()
  @IsIn([
    'inside_dhaka',
    'outside_dhaka',
  ])
  zone?: string;
}

export class PlaceOrderDto {
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer!: CheckoutCustomerDto;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  /*
   * 'cod' (cash on delivery) when left out. 'sslcommerz' sends the
   * customer to the payment gateway after the order is saved.
   */
  @IsOptional()
  @IsIn(['cod', 'sslcommerz'])
  paymentMethod?: 'cod' | 'sslcommerz';
}

export class UpdateOrderStatusDto {
  @IsIn([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ])
  status!: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;
}
