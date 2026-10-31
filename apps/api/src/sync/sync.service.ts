import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveBillsDto, SaveProfileDto } from './dto/sync.dto';

const MAX_RECORD_CHARS = 60_000;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const plain = (v: unknown) => JSON.parse(JSON.stringify(v ?? null));

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(userId: string) {
    const [rows, profile] = await Promise.all([
      this.prisma.splitRecord.findMany({ where: { userId }, orderBy: { clientUpdatedAt: 'desc' }, take: 1000 }),
      this.prisma.splitProfile.findUnique({ where: { userId } }),
    ]);
    return {
      bills: rows.map((r: any) => ({
        id: r.recordId,
        deleted: r.deleted,
        updatedAt: r.clientUpdatedAt.toISOString(),
        data: r.deleted ? null : r.data,
      })),
      profile: profile
        ? {
            paymentMethods: asArray(profile.paymentMethods),
            friends: asArray(profile.friends),
            updatedAt: profile.clientUpdatedAt.toISOString(),
          }
        : null,
    };
  }

  /** Simpan/hapus tagihan. Tulisan yang lebih lama dari yang sudah tersimpan diabaikan. */
  async saveBills(userId: string, dto: SaveBillsDto) {
    let saved = 0;
    for (const b of dto.bills) {
      const at = new Date(b.updatedAt);
      const data = b.deleted ? {} : plain(b.data ?? {});
      if (JSON.stringify(data).length > MAX_RECORD_CHARS) throw new BadRequestException('Data tagihan terlalu besar');
      const key = { userId_recordId: { userId, recordId: b.id } };
      const existing = await this.prisma.splitRecord.findUnique({ where: key });
      if (existing && existing.clientUpdatedAt >= at) continue;
      await this.prisma.splitRecord.upsert({
        where: key,
        update: { data, deleted: !!b.deleted, clientUpdatedAt: at },
        create: { userId, recordId: b.id, data, deleted: !!b.deleted, clientUpdatedAt: at },
      });
      saved++;
    }
    return { saved };
  }

  async saveProfile(userId: string, dto: SaveProfileDto) {
    const at = new Date(dto.updatedAt);
    const paymentMethods = plain(dto.paymentMethods);
    const friends = plain(dto.friends);
    if (JSON.stringify([paymentMethods, friends]).length > MAX_RECORD_CHARS) throw new BadRequestException('Data terlalu besar');
    const existing = await this.prisma.splitProfile.findUnique({ where: { userId } });
    if (existing && existing.clientUpdatedAt >= at) return { saved: false };
    await this.prisma.splitProfile.upsert({
      where: { userId },
      update: { paymentMethods, friends, clientUpdatedAt: at },
      create: { userId, paymentMethods, friends, clientUpdatedAt: at },
    });
    return { saved: true };
  }
}