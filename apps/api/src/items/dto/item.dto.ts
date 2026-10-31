import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CreateItemDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  /** Total harga baris ini (rupiah), mis. Es Teh x3 = 15000 */
  @IsInt() @Min(0) @Max(100_000_000)
  price: number;

  @IsOptional() @IsInt() @Min(1) @Max(999)
  qty?: number;
}

export class UpdateItemDto extends PartialType(CreateItemDto) {}

export class BulkItemsDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CreateItemDto)
  items: CreateItemDto[];
}

export class SetAssignmentsDto {
  @IsArray() @ArrayMaxSize(30) @IsUUID('all', { each: true })
  participantIds: string[];
}
