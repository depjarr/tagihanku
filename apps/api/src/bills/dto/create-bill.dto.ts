import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber,
  IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PaymentType } from '@prisma/client';

export class PaymentMethodDto {
  @IsEnum(PaymentType)
  type: PaymentType;

  @IsString() @IsNotEmpty() @MaxLength(60)
  label: string;

  @IsOptional() @IsString() @MaxLength(40)
  accountNumber?: string;

  @IsOptional() @IsString() @MaxLength(80)
  accountName?: string;

  /** Isi QRIS statis (hasil baca foto QRIS), selalu diawali "000201". */
  @IsOptional() @IsString() @MaxLength(600) @Matches(/^000201/, { message: 'Isi QRIS tidak valid' })
  qrisPayload?: string;
}

export class CreateBillDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title: string;

  /** Format YYYY-MM-DD */
  @IsDateString()
  billDate: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  taxPercent: number;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  servicePercent: number;

  /** Nama peserta; yang PERTAMA otomatis menjadi pembuat tagihan. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(60, { each: true })
  participants: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => PaymentMethodDto)
  paymentMethods?: PaymentMethodDto[];
}
