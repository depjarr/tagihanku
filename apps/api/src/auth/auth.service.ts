import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com'];

const ROUNDS = 10;
const RESET_TTL_MS = 30 * 60 * 1000; // 30 menit, sekali pakai
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
// hash palsu supaya waktu respons login tidak membocorkan apakah email terdaftar
const DUMMY_HASH = hashSync('dummy-password', ROUNDS);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  private publicUser(u: { id: string; name: string; email: string; passwordHash?: string | null; googleId?: string | null }) {
    return { id: u.id, name: u.name, email: u.email, hasPassword: !!u.passwordHash, googleLinked: !!u.googleId };
  }

  private session(u: { id: string; name: string; email: string; passwordHash?: string | null; googleId?: string | null }) {
    return { token: this.jwt.sign({ sub: u.id }), user: this.publicUser(u) };
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email sudah terdaftar');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email,
        passwordHash: await hash(dto.password, ROUNDS),
        settings: { create: {} },
      },
    });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Email atau kata sandi salah');
    return this.session(user);
  }

  /**
   * Masuk / daftar lewat Google. `credential` = ID token dari Google Identity Services.
   * Diverifikasi ke endpoint tokeninfo Google (cukup untuk skala kecil; tanpa dependensi tambahan).
   */
  async googleLogin(credential: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new BadRequestException('Login Google belum dikonfigurasi di server');
    let info: any;
    try {
      const res = await (globalThis as any).fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
      info = await res.json();
    } catch (e) {
      this.logger.warn(`Verifikasi token Google gagal: ${(e as Error).message}`);
      throw new UnauthorizedException('Token Google tidak valid');
    }
    const valid =
      info?.aud === clientId && GOOGLE_ISS.includes(info?.iss) && String(info?.email_verified) === 'true' &&
      !!info?.email && !!info?.sub;
    if (!valid) throw new UnauthorizedException('Token Google tidak valid');

    const email = String(info.email).toLowerCase();
    const sub = String(info.sub);
    let user =
      (await this.prisma.user.findUnique({ where: { googleId: sub } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));
    if (user && !user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: sub } }); // tautkan akun lama
    }
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: String(info.name || email.split('@')[0]).trim().slice(0, 80),
          email,
          googleId: sub,
          settings: { create: {} },
        },
      });
    }
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    return this.publicUser(user);
  }

  async updateProfile(userId: string, name: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name: name.trim() } });
    return this.publicUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.passwordHash) {
      throw new BadRequestException('Akun ini masuk lewat Google. Pakai "Lupa password" di halaman masuk untuk membuat kata sandi.');
    }
    if (!user || !(await compare(dto.currentPassword, user.passwordHash!))) {
      throw new BadRequestException('Kata sandi saat ini salah');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hash(dto.newPassword, ROUNDS) } });
    return { message: 'Kata sandi diperbarui' };
  }

  /** Selalu menjawab sama, baik email terdaftar maupun tidak (mencegah enumerasi email). */
  async forgotPassword(email: string) {
    const generic = { message: 'Jika email terdaftar, tautan reset kata sandi sudah dikirim.' };
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return generic;

    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    const base = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const link = `${base}/reset-password?token=${token}`;
    try {
      await this.mail.send(
        user.email,
        'Atur ulang kata sandi Tagihanku',
        `Halo ${user.name},\n\nKlik tautan berikut untuk membuat kata sandi baru (berlaku 30 menit dan hanya bisa dipakai sekali):\n${link}\n\nAbaikan email ini jika kamu tidak memintanya.`,
      );
    } catch (e) {
      this.logger.error(`Gagal mengirim email reset: ${(e as Error).message}`);
    }
    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Tautan tidak valid atau sudah kedaluwarsa');
    }
    const passwordHash = await hash(dto.password, ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.passwordReset.deleteMany({ where: { userId: row.userId, usedAt: null } }),
    ]);
    return { message: 'Kata sandi berhasil diubah. Silakan masuk.' };
  }
}
