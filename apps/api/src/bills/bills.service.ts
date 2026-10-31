import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SplitService } from '../split/split.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';

export const billInclude = {
  participants: { orderBy: { sortOrder: 'asc' } },
  items: { orderBy: { sortOrder: 'asc' }, include: { assignments: true } },
  paymentMethods: { orderBy: { label: 'asc' } },
} satisfies Prisma.BillInclude;
type BillFull = Prisma.BillGetPayload<{ include: typeof billInclude }>;

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly split: SplitService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Bentuk respons ke frontend (tanpa ownerToken). */
  toView(bill: BillFull, viewerId?: string) {
    const result = this.split.calculate({
      participants: bill.participants.map((p) => ({ id: p.id, name: p.name })),
      items: bill.items.map((i) => ({
        id: i.id,
        price: i.price,
        participantIds: i.assignments.map((a) => a.participantId),
      })),
      taxPercent: Number(bill.taxPercent),
      servicePercent: Number(bill.servicePercent),
    });
    const paidAt = new Map(bill.participants.map((p) => [p.id, p.paidAt]));
    const shares = result.shares.map((s) => ({
      ...s,
      paid: !!paidAt.get(s.participantId),
      paidAt: paidAt.get(s.participantId) ?? null,
    }));
    const paidTotal = shares.filter((s) => s.paid).reduce((a, s) => a + s.total, 0);

    return {
      id: bill.id,
      title: bill.title,
      billDate: bill.billDate.toISOString().slice(0, 10),
      taxPercent: Number(bill.taxPercent),
      servicePercent: Number(bill.servicePercent),
      status: bill.status,
      isMine: !!viewerId && bill.userId === viewerId,
      shareCode: bill.shareCode,
      createdAt: bill.createdAt,
      participants: bill.participants.map((p) => ({
        id: p.id, name: p.name, isOwner: p.isOwner, paidAt: p.paidAt,
      })),
      items: bill.items.map((i) => ({
        id: i.id, name: i.name, price: i.price, qty: i.qty,
        participantIds: i.assignments.map((a) => a.participantId),
      })),
      paymentMethods: bill.paymentMethods.map((m) => ({
        id: m.id, type: m.type, label: m.label, accountNumber: m.accountNumber, accountName: m.accountName,
        qrisPayload: m.qrisPayload,
      })),
      summary: {
        ...result,
        shares,
        paidCount: shares.filter((s) => s.paid).length,
        paidTotal,
        remaining: result.grandTotal - paidTotal,
      },
    };
  }

  async create(dto: CreateBillDto, userId?: string) {
    const names = dto.participants.map((n) => n.trim()).filter(Boolean);
    const unique = new Set(names.map((n) => n.toLowerCase()));
    if (names.length === 0 || unique.size !== names.length) {
      throw new BadRequestException('Nama peserta tidak boleh kosong atau kembar');
    }
    const ownerToken = randomBytes(24).toString('hex');
    const bill = await this.prisma.bill.create({
      data: {
        title: dto.title.trim(),
        billDate: new Date(dto.billDate),
        taxPercent: dto.taxPercent,
        servicePercent: dto.servicePercent,
        shareCode: randomBytes(6).toString('base64url'),
        ownerToken,
        userId: userId ?? null,
        participants: {
          create: names.map((name, i) => ({
            name,
            isOwner: i === 0,
            paidAt: i === 0 ? new Date() : null, // pembuat sudah membayar di restoran
            sortOrder: i,
          })),
        },
        paymentMethods: {
          create: (dto.paymentMethods ?? []).map((m) => ({
            type: m.type,
            label: m.label.trim(),
            accountNumber: m.accountNumber?.trim() || null,
            accountName: m.accountName?.trim() || null,
            qrisPayload: m.type === 'QRIS' ? m.qrisPayload?.trim() || null : null,
          })),
        },
      },
      include: billInclude,
    });
    if (userId) {
      await this.notifications.notify(
        userId, 'BILL_CREATED', 'Tagihan dibuat', `"${bill.title}" siap dibagikan ke teman.`, bill.id,
      );
    }
    return { ...this.toView(bill, userId), ownerToken };
  }

  async findMany(ids: string[], viewerId?: string) {
    const bills = await this.prisma.bill.findMany({
      where: { id: { in: ids } },
      include: billInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bills.map((b: { participants: { id: string; name: string; billId: string; sortOrder: number; isOwner: boolean; paidAt: Date | null; openedAt: Date | null; }[]; items: ({ assignments: { itemId: string; participantId: string; }[]; } & { id: string; name: string; billId: string; sortOrder: number; price: number; qty: number; })[]; paymentMethods: { id: string; type: $Enums.PaymentType; billId: string; label: string; accountNumber: string | null; accountName: string | null; qrisPayload: string | null; }[]; } & { createdAt: Date; id: string; title: string; billDate: Date; taxPercent: Prisma.Decimal; servicePercent: Prisma.Decimal; status: $Enums.BillStatus; shareCode: string; ownerToken: string; userId: string | null; updatedAt: Date; }) => this.toView(b, viewerId));
  }

  async findByUser(userId: string) {
    const bills = await this.prisma.bill.findMany({
      where: { userId },
      include: billInclude,
      orderBy: { createdAt: 'desc' },
    });
    return bills.map((b: { participants: { id: string; name: string; billId: string; sortOrder: number; isOwner: boolean; paidAt: Date | null; openedAt: Date | null; }[]; items: ({ assignments: { itemId: string; participantId: string; }[]; } & { id: string; name: string; billId: string; sortOrder: number; price: number; qty: number; })[]; paymentMethods: { id: string; type: $Enums.PaymentType; billId: string; label: string; accountNumber: string | null; accountName: string | null; qrisPayload: string | null; }[]; } & { createdAt: Date; id: string; title: string; billDate: Date; taxPercent: Prisma.Decimal; servicePercent: Prisma.Decimal; status: $Enums.BillStatus; shareCode: string; ownerToken: string; userId: string | null; updatedAt: Date; }) => this.toView(b, userId));
  }

  /** Menautkan tagihan tamu (id + ownerToken dari localStorage) ke akun yang baru login. */
  async claim(userId: string, items: { id: string; token: string }[]) {
    let claimed = 0;
    for (const { id, token } of items.slice(0, 100)) {
      const bill = await this.prisma.bill.findUnique({ where: { id }, select: { ownerToken: true, userId: true } });
      if (!bill || bill.userId) continue;
      const a = Buffer.from(token);
      const b = Buffer.from(bill.ownerToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) continue;
      await this.prisma.bill.update({ where: { id }, data: { userId } });
      claimed++;
    }
    return { claimed };
  }

  async getView(id: string, viewerId?: string) {
    const bill = await this.prisma.bill.findUnique({ where: { id }, include: billInclude });
    if (!bill) throw new NotFoundException('Tagihan tidak ditemukan');
    return this.toView(bill, viewerId);
  }

  async findByShare(code: string, viewerId?: string) {
    const bill = await this.prisma.bill.findUnique({ where: { shareCode: code }, include: billInclude });
    if (!bill) throw new NotFoundException('Link tagihan tidak ditemukan');
    return this.toView(bill, viewerId);
  }

  /** Dipanggil halaman teman saat ia memilih namanya: beri tahu pembuat (sekali per peserta). */
  async markOpened(code: string, participantId: string) {
    const bill = await this.prisma.bill.findUnique({ where: { shareCode: code }, include: { participants: true } });
    if (!bill) throw new NotFoundException('Link tagihan tidak ditemukan');
    const p = bill.participants.find((x: { id: string; }) => x.id === participantId);
    if (!p) throw new NotFoundException('Peserta tidak ditemukan');
    if (p.isOwner || p.openedAt) return { ok: true };
    await this.prisma.participant.update({ where: { id: p.id }, data: { openedAt: new Date() } });
    if (bill.userId) {
      await this.notifications.notify(
        bill.userId, 'LINK_OPENED', `${p.name} membuka link tagihan`, `"${bill.title}"`, bill.id,
      );
    }
    return { ok: true };
  }

  async update(id: string, dto: UpdateBillDto) {
    await this.prisma.bill.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        billDate: dto.billDate ? new Date(dto.billDate) : undefined,
        taxPercent: dto.taxPercent,
        servicePercent: dto.servicePercent,
      },
    });
    return this.getView(id);
  }

  async remove(id: string) {
    await this.prisma.bill.delete({ where: { id } });
  }
}
