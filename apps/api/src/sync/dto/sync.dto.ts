import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';

/** Satu tagihan dari alur split bill. `data` = isi tagihan apa adanya (JSON); server tidak menafsirkannya. */
export class SyncBillDto {
  @IsString() @IsNotEmpty() @MaxLength(64)
  id: string;

  /** Waktu ubah di perangkat; yang lebih baru menang (last-write-wins). */
  @IsISO8601()
  updatedAt: string;

  @IsOptional() @IsBoolean()
  deleted?: boolean;

  @IsOptional() @IsObject()
  data?: Record<string, unknown>;
}

export class SaveBillsDto {
  @IsArray() @ArrayMaxSize(25)
  @ValidateNested({ each: true }) @Type(() => SyncBillDto)
  bills: SyncBillDto[];
}

export class SaveProfileDto {
  @IsISO8601()
  updatedAt: string;

  @IsArray() @ArrayMaxSize(20)
  paymentMethods: unknown[];

  @IsArray() @ArrayMaxSize(200)
  friends: unknown[];
}