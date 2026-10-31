import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddParticipantDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;
}

export class SetPaidDto {
  @IsBoolean()
  paid: boolean;
}
