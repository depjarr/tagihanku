import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { PaymentMethodDto } from '../../bills/dto/create-bill.dto';

export const ACCENTS = ['biru', 'merah', 'kuning', 'hijau', 'ungu', 'peach', 'kidcore', 'pixel', 'fairy', 'apple'] as const;

export class UpdateSettingsDto {
  @IsOptional() @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @IsOptional() @IsIn(ACCENTS as unknown as string[])
  accent?: (typeof ACCENTS)[number];

  @IsOptional() @IsBoolean()
  notifyPaid?: boolean;

  @IsOptional() @IsBoolean()
  notifyDone?: boolean;

  @IsOptional() @IsBoolean()
  notifyOpened?: boolean;

  @IsOptional() @IsBoolean()
  notifyReminder?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(30)
  reminderDays?: number;

  @IsOptional() @IsBoolean()
  notifyEmail?: boolean;

  /** Metode pembayaran bawaan: otomatis terisi saat membuat tagihan baru. */
  @IsOptional() @IsArray() @ArrayMaxSize(10)
  @ValidateNested({ each: true }) @Type(() => PaymentMethodDto)
  defaultPaymentMethods?: PaymentMethodDto[];
}