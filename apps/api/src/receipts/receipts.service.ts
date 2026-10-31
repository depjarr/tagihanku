import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { OCR_PROVIDER, OcrProvider } from './ocr/ocr.provider';
import { GroqOcrProvider, ParsedAiReceipt } from './ocr/groq-ocr.provider';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    private readonly groq: GroqOcrProvider,
  ) {}

  async scanDirect(file: Express.Multer.File): Promise<ParsedAiReceipt> {
    // Panggil Groq langsung tanpa memalsukan data jika ada error
    return await this.groq.parseWithVision(file.buffer, file.mimetype);
  }

  async process(billId: string, file: Express.Multer.File) {
    const dir = process.env.UPLOAD_DIR ?? './uploads';
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${randomUUID()}${extname(file.originalname).toLowerCase() || '.jpg'}`);
    await writeFile(filePath, file.buffer);

    const parsed = await this.groq.parseWithVision(file.buffer, file.mimetype);
    await this.prisma.receipt.create({
      data: {
        billId,
        filePath,
        mimeType: file.mimetype,
        rawText: JSON.stringify(parsed),
        status: 'PROCESSED',
      },
    });
    return parsed;
  }
}