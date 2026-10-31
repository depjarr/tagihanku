import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BillsService } from '../bills/bills.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParticipantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillsService,
    private readonly notifications: NotificationsService,
  ) {}

  async add(billId: string, rawName: string) {
    const name = rawName.trim();
    const existing = await this.prisma.participant.findMany({
      where: { billId },
      select: { name: true, sortOrder: true },
    });
    if (existing.some((p: { name: string; }) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new ConflictException('Nama peserta sudah ada');
    }
    const next = existing.reduce((m: number, p: { sortOrder: number; }) => Math.max(m, p.sortOrder), -1) + 1;
    await this.prisma.participant.create({ data: { billId, name, sortOrder: next } });
    await this.syncStatus(billId);
    return this.bills.getView(billId);
  }

  async remove(billId: string, participantId: string) {
    const p = await this.find(billId, participantId);
    if (p.isOwner) throw new BadRequestException('Pembuat tagihan tidak bisa dihapus');
    await this.prisma.participant.delete({ where: { id: participantId } });
    await this.syncStatus(billId);
    return this.bills.getView(billId);
  }

  async setPaid(billId: string, participantId: string, paid: boolean) {
    const person = await this.find(billId, participantId);
    const before = await this.prisma.bill.findUnique({
      where: { id: billId },
      select: { userId: true, title: true, status: true },
    });
    await this.prisma.participant.update({
      where: { id: participantId },
      data: { paidAt: paid ? new Date() : null },
    });
    await this.syncStatus(billId);

    if (paid && !person.paidAt && before?.userId) {
      await this.notifications.notify(
        before.userId, 'PAID', `${person.name} sudah bayar`, `Pembayaran untuk "${before.title}" sudah dicatat.`, billId,
      );
      const after = await this.prisma.bill.findUnique({ where: { id: billId }, select: { status: true } });
      if (after?.status === 'DONE' && before.status !== 'DONE') {
        await this.notifications.notify(
          before.userId, 'BILL_DONE', 'Tagihan lunas 🎉', `Semua peserta "${before.title}" sudah membayar.`, billId,
        );
      }
    }
    return this.bills.getView(billId);
  }

  private async find(billId: string, participantId: string) {
    const p = await this.prisma.participant.findFirst({ where: { id: participantId, billId } });
    if (!p) throw new NotFoundException('Peserta tidak ditemukan');
    return p;
  }

  /** Tagihan otomatis pindah ke SELESAI saat semua peserta lunas. */
  private async syncStatus(billId: string) {
    const unpaid = await this.prisma.participant.count({ where: { billId, paidAt: null } });
    await this.prisma.bill.update({ where: { id: billId }, data: { status: unpaid === 0 ? 'DONE' : 'ACTIVE' } });
  }
}
