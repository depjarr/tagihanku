import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnerGuard } from '../common/owner.guard';
import { ClaimBillsDto } from './dto/claim-bills.dto';
import { OpenShareDto } from './dto/open-share.dto';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('bills')
@Controller('bills')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Post()
  @ApiOperation({ summary: 'Buat tagihan. Respons berisi ownerToken — simpan di browser pembuat.' })
  create(@Body() dto: CreateBillDto, @Req() req: any) {
    return this.bills.create(dto, req.user?.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Daftar tagihan milik perangkat ini: /bills?ids=uuid1,uuid2' })
  list(@Query('ids') ids = '', @Req() req: any) {
    const list = ids.split(',').map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 50);
    return list.length ? this.bills.findMany(list, req.user?.sub) : [];
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Semua tagihan milik akun yang login' })
  mine(@CurrentUser() userId: string) {
    return this.bills.findByUser(userId);
  }

  @Post('claim')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tautkan tagihan tamu (id + ownerToken) ke akun ini' })
  claim(@CurrentUser() userId: string, @Body() dto: ClaimBillsDto) {
    return this.bills.claim(userId, dto.bills);
  }

  @Get('share/:code')
  @ApiOperation({ summary: 'Tampilan publik untuk teman (hanya lihat)' })
  byShare(@Param('code') code: string, @Req() req: any) {
    return this.bills.findByShare(code, req.user?.sub);
  }

  @Post('share/:code/open')
  @HttpCode(200)
  @ApiOperation({ summary: 'Teman memilih namanya di link berbagi → pembuat dapat notifikasi (sekali per peserta)' })
  opened(@Param('code') code: string, @Body() dto: OpenShareDto) {
    return this.bills.markOpened(code, dto.participantId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.bills.getView(id, req.user?.sub);
  }

  @Patch(':id')
  @UseGuards(OwnerGuard)
  @ApiSecurity('owner-token')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBillDto) {
    return this.bills.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(OwnerGuard)
  @ApiSecurity('owner-token')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.bills.remove(id);
  }
}
