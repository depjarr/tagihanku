import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { OwnerGuard } from '../common/owner.guard';
import { BulkItemsDto, CreateItemDto, SetAssignmentsDto, UpdateItemDto } from './dto/item.dto';
import { ItemsService } from './items.service';

@ApiTags('items')
@ApiSecurity('owner-token')
@UseGuards(OwnerGuard)
@Controller('bills/:billId/items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}

  @Post()
  add(@Param('billId', ParseUUIDPipe) billId: string, @Body() dto: CreateItemDto) {
    return this.service.add(billId, dto);
  }

  @Post('bulk')
  bulk(@Param('billId', ParseUUIDPipe) billId: string, @Body() dto: BulkItemsDto) {
    return this.service.bulkAdd(billId, dto.items);
  }

  @Patch(':itemId')
  update(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.update(billId, itemId, dto);
  }

  @Delete(':itemId')
  remove(@Param('billId', ParseUUIDPipe) billId: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.remove(billId, itemId);
  }

  @Put(':itemId/assignments')
  assign(
    @Param('billId', ParseUUIDPipe) billId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SetAssignmentsDto,
  ) {
    return this.service.setAssignments(billId, itemId, dto.participantIds);
  }
}
