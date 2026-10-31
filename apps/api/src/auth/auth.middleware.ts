import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Tidak menolak apa pun — hanya mengisi `req.user` bila ada Bearer token yang valid,
 * sehingga endpoint publik (mode tamu) tetap berfungsi tanpa login.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(req: any, _res: unknown, next: () => void) {
    const header = req.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<{ sub: string }>(header.slice(7));
        req.user = { sub: payload.sub };
      } catch {
        /* token kedaluwarsa/rusak → anggap tamu */
      }
    }
    next();
  }
}
