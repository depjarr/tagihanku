import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class ClaimItemDto {
  @IsUUID() id: string;
  @IsString() @IsNotEmpty() @MaxLength(64) token: string;
}

export class ClaimBillsDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ClaimItemDto)
  bills: ClaimItemDto[];
}
