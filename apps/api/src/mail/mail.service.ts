import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

/**
 * MAIL_PROVIDER=console (default) → isi email dicetak ke log server (cukup untuk development,
 * link reset password tinggal disalin dari log). MAIL_PROVIDER=smtp → kirim lewat SMTP.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(to: string, subject: string, text: string): Promise<void> {
    if (process.env.MAIL_PROVIDER !== 'smtp') {
      this.logger.log(`\n[EMAIL → ${to}] ${subject}\n${text}\n`);
      return;
    }
    const transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
  }
}
