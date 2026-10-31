import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillsService } from '../bills/bills.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService, private readonly bills: BillsService) {}

  private async nextOrder(billId: string) {
    const agg = await this.prisma.item.aggregate({ where: { billId }, _max: { sortOrder: true } });
    return (agg._max.sortOrder ?? -1) + 1;
  }

  async add(billId: string, dto: CreateItemDto) {
    await this.prisma.item.create({
      data: {
        billId, name: dto.name.trim(), price: dto.price, qty: dto.qty ?? 1,
        sortOrder: await this.nextOrder(billId),
      },
    });
    return this.bills.getView(billId);
  }

  async bulkAdd(billId: string, items: CreateItemDto[]) {
    const start = await this.nextOrder(billId);
    await this.prisma.item.createMany({
      data: items.map((d, i) => ({
        billId, name: d.name.trim(), price: d.price, qty: d.qty ?? 1, sortOrder: start + i,
      })),
    });
    return this.bills.getView(billId);
  }

  async update(billId: string, itemId: string, dto: UpdateItemDto) {
    await this.mustFind(billId, itemId);
    await this.prisma.item.update({
      where: { id: itemId },
      data: { name: dto.name?.trim(), price: dto.price, qty: dto.qty },
    });
    return this.bills.getView(billId);
  }

  async remove(billId: string, itemId: string) {
    await this.mustFind(billId, itemId);
    await this.prisma.item.delete({ where: { id: itemId } });
    return this.bills.getView(billId);
  }

  /** Ganti daftar peserta yang menanggung item (dibagi rata di antara mereka). */
  async setAssignments(billId: string, itemId: string, participantIds: string[]) {
    await this.mustFind(billId, itemId);
    const ids = [...new Set(participantIds)];
    const valid = await this.prisma.participant.count({ where: { billId, id: { in: ids } } });
    if (valid !== ids.length) throw new BadRequestException('Ada peserta yang bukan bagian dari tagihan ini');

    await this.prisma.$transaction([
      this.prisma.itemAssignment.deleteMany({ where: { itemId } }),
      this.prisma.itemAssignment.createMany({ data: ids.map((participantId) => ({ itemId, participantId })) }),
    ]);
    return this.bills.getView(billId);
  }

  private async mustFind(billId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({ where: { id: itemId, billId }, select: { id: true } });
    if (!item) throw new NotFoundException('Item tidak ditemukan');
  }
}
