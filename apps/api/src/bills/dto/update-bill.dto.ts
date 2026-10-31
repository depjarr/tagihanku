import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateBillDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  title?: string;

  @IsOptional() @IsDateString()
  billDate?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  taxPercent?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  servicePercent?: number;
}
