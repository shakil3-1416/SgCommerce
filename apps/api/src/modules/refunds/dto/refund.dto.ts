import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateRefundDto {
  @IsIn([
    'pending',
    'completed',
    'failed',
  ])
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
