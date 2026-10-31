import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

type Row = {
  theme: string; accent: string; notifyPaid: boolean; notifyDone: boolean; notifyOpened: boolean;
  notifyReminder: boolean; reminderDays: number; notifyEmail: boolean; defaultPaymentMethods: unknown;
};

const pick = (s: Row) => ({
  theme: s.theme, accent: s.accent,
  notifyPaid: s.notifyPaid, notifyDone: s.notifyDone, notifyOpened: s.notifyOpened,
  notifyReminder: s.notifyReminder, reminderDays: s.reminderDays, notifyEmail: s.notifyEmail,
  defaultPaymentMethods: Array.isArray(s.defaultPaymentMethods) ? s.defaultPaymentMethods : [],
});

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() userId: string) {
    const s = await this.prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });
    return pick(s as Row);
  }

  @Patch()
  async update(@CurrentUser() userId: string, @Body() dto: UpdateSettingsDto) {
    const { defaultPaymentMethods, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (defaultPaymentMethods) {
      // buang instance class → JSON polos; QRIS hanya menyimpan payload bila tipenya QRIS
      data.defaultPaymentMethods = JSON.parse(
        JSON.stringify(defaultPaymentMethods.map((m) => ({ ...m, qrisPayload: m.type === 'QRIS' ? m.qrisPayload : undefined }))),
      );
    }
    const s = await this.prisma.userSettings.upsert({
      where: { userId }, update: data as any, create: { userId, ...(data as any) },
    });
    return pick(s as Row);
  }
}
