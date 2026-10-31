import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SaveBillsDto, SaveProfileDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Semua tagihan (termasuk tanda hapus), metode pembayaran, dan daftar teman milik akun. */
  @Get()
  pull(@CurrentUser() userId: string) {
    return this.sync.pull(userId);
  }

  @Post('bills')
  saveBills(@CurrentUser() userId: string, @Body() dto: SaveBillsDto) {
    return this.sync.saveBills(userId, dto);
  }

  @Put('profile')
  saveProfile(@CurrentUser() userId: string, @Body() dto: SaveProfileDto) {
    return this.sync.saveProfile(userId, dto);
  }
}