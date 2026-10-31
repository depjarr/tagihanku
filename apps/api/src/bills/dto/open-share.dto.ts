import { IsUUID } from 'class-validator';

export class OpenShareDto {
  @IsUUID()
  participantId: string;
}
