import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CheckoutCustomerDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(6, 30)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
