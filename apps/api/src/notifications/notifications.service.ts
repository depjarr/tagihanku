import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType = 'BILL_CREATED' | 'PAID' | 'BILL_DONE' | 'REMINDER' | 'LINK_OPENED';
const DAY = 86_400_000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) {}

  /** Membuat notifikasi in-app sesuai pengaturan user. Tidak pernah melempar error ke pemanggil. */
  async notify(userId: string, type: NotificationType, title: string, body: string, billId?: string) {
    try {
      const st = await this.prisma.userSettings.findUnique({ where: { userId } });
      if (type === 'PAID' && st && !st.notifyPaid) return;
      if (type === 'BILL_DONE' && st && !st.notifyDone) return;
      if (type === 'LINK_OPENED' && !st?.notifyOpened) return; // default mati: tidak ada baris = tidak aktif
      if (type === 'REMINDER' && st && !st.notifyReminder) return;

      await this.prisma.notification.create({
        data: { userId, billId: billId ?? null, type, title: title.slice(0, 120), body: body.slice(0, 255) },
      });

      if (type === 'REMINDER' && st?.notifyEmail) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user) await this.mail.send(user.email, title, body);
      }
    } catch (e) {
      this.logger.error(`Gagal membuat notifikasi: ${(e as Error).message}`);
    }
  }

  async list(userId: string, limit = 30) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { unread, items };
  }

  async unreadCount(userId: string) {
    return { unread: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { unread: 0 };
  }

  async clear(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } });
    return { unread: 0 };
  }

  /** Tiap hari 09:00 WIB: ingatkan pembuat tagihan yang masih ada peserta belum bayar. */
  @Cron('0 9 * * *', { timeZone: 'Asia/Jakarta' })
  async sendReminders() {
    const bills = await this.prisma.bill.findMany({
      where: { status: 'ACTIVE', userId: { not: null } },
      include: { participants: true, user: { include: { settings: true } } },
    });
    let sent = 0;
    for (const b of bills) {
      if (!b.user) continue;
      const days = b.user.settings?.reminderDays ?? 3;
      if (Date.now() - b.createdAt.getTime() < days * DAY) continue;
      const recent = await this.prisma.notification.findFirst({
        where: { billId: b.id, type: 'REMINDER', createdAt: { gte: new Date(Date.now() - days * DAY) } },
      });
      if (recent) continue;
      const unpaid = b.participants.filter((p: { paidAt: any; }) => !p.paidAt).map((p: { name: any; }) => p.name);
      if (!unpaid.length) continue;
      await this.notify(
        b.user.id, 'REMINDER', `Ingatkan teman: ${b.title}`,
        `${unpaid.length} orang belum bayar: ${unpaid.slice(0, 4).join(', ')}${unpaid.length > 4 ? ', …' : ''}.`, b.id,
      );
      sent++;
    }
    this.logger.log(`Pengingat harian: ${sent} notifikasi dibuat`);
  }
}
