import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Hanya pembuat tagihan yang boleh mengubah data. Dua cara dikenali:
 *  1. login sebagai akun pemilik tagihan (Authorization: Bearer …), atau
 *  2. mode tamu: pemegang x-owner-token.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const billId = req.params.billId ?? req.params.id;
    const bill = await this.prisma.bill.findUnique({
      where: { id: billId },
      select: { ownerToken: true, userId: true },
    });
    if (!bill) throw new NotFoundException('Tagihan tidak ditemukan');

    const uid: string | undefined = req.user?.sub;
    if (uid && bill.userId === uid) return true;

    const token = req.headers['x-owner-token'];
    if (typeof token !== 'string' || !token) throw new UnauthorizedException('Token pembuat dibutuhkan');
    const a = Buffer.from(token);
    const b = Buffer.from(bill.ownerToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Token pembuat salah');
    }
    return true;
  }
}
