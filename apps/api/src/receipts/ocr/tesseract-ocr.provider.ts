import { mkdir } from 'fs/promises';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Worker } from 'tesseract.js';
import { OcrProvider } from './ocr.provider';

/**
 * OCR sungguhan, gratis, jalan di server sendiri (tesseract.js).
 * - Data bahasa `ind`+`eng` diunduh sekali lalu disimpan di OCR_CACHE_DIR (server butuh internet untuk unduhan pertama).
 * - Satu worker dipakai ulang; permintaan diproses antre satu per satu supaya hemat memori.
 */
@Injectable()
export class TesseractOcrProvider implements OcrProvider, OnModuleDestroy {
  private readonly log = new Logger('TesseractOcr');
  private worker?: Promise<Worker>;
  private queue: Promise<unknown> = Promise.resolve();

  private getWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = (async () => {
        const { createWorker } = await import('tesseract.js');
        this.log.log('Memuat mesin OCR (pertama kali bisa beberapa detik)…');
        const cachePath = process.env.OCR_CACHE_DIR ?? './.tessdata';
        await mkdir(cachePath, { recursive: true }).catch(() => undefined);
        const w = await createWorker('ind+eng', 1, { cachePath } as any);
        // PSM 4 = satu kolom teks dengan ukuran berbeda-beda → cocok untuk struk
        await w.setParameters({
          tessedit_pageseg_mode: '4',
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        } as any);
        return w;
      })().catch((e) => {
        this.worker = undefined; // coba lagi di permintaan berikutnya
        this.log.error(`Gagal memuat OCR: ${e?.message ?? e}`);
        throw e;
      });
    }
    return this.worker;
  }

  recognize(image: Buffer): Promise<string> {
    const job = async () => {
      const w = await this.getWorker();
      const { data } = await w.recognize(image);
      return data.text;
    };
    const result = this.queue.then(job, job) as Promise<string>;
    this.queue = result.catch(() => undefined);
    return result;
  }

  async onModuleDestroy() {
    try { await (await this.worker)?.terminate(); } catch { /* abaikan */ }
  }
}
