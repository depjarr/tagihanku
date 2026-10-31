import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OwnerGuard } from '../common/owner.guard';
import { AddParticipantDto, SetPaidDto } from './dto/participant.dto';
import { ParticipantsService } from './participants.service';

@ApiTags('participants')
@ApiSecurity('owner-token')
@UseGuards(OwnerGuard)
@Controller('bills/:billId/participants')
export class ParticipantsController {
  constructor(private readonly service: ParticipantsService) {}

  @Post()
  add(@Param('billId', ParseUUIDPipe) billId: string, @Body() dto: AddParticipantDto) {
    return this.service.add(billId, dto.name);
  }

  @Delete(':participantId')
  remove(@Param('billId', ParseUUIDPipe) billId: string, @Param('participantId', ParseUUIDPipe) pid: string) {
    return this.service.remove(billId, pid);
  }

  @Patch(':participantId/paid')
  setPaid(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Param('participantId', ParseUUIDPipe) pid: string,
    @Body() dto: SetPaidDto,
  ) {
    return this.service.setPaid(billId, pid, dto.paid);
  }
}
