import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OcrProvider } from './ocr.provider';

export interface ParsedAiReceipt {
  merchant: string;
  date: string;
  lines: Array<{ name: string; price: number; qty: number }>;
  subtotal: number;
  service: number;
  tax: number;
  total: number;
}

@Injectable()
export class GroqOcrProvider implements OcrProvider {
  private readonly logger = new Logger(GroqOcrProvider.name);
  private readonly apiKey = process.env.GROQ_API_KEY || '';

  async recognize(image: Buffer, mimeType: string): Promise<string> {
    const parsed = await this.parseWithVision(image, mimeType);
    return JSON.stringify(parsed);
  }

  async parseWithVision(image: Buffer, mimeType: string): Promise<ParsedAiReceipt> {
    if (!this.apiKey) {
      throw new BadRequestException('GROQ_API_KEY belum disetel di file .env!');
    }

    const base64Data = image.toString('base64');
    const imageUrl = `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

    // Prompt khusus mendeteksi nama produk, harga, PB1/PPN, dan Service Charge struk Indonesia
    const prompt = `Kamu adalah asisten OCR AI khusus struk restoran dan kafe di Indonesia.
Tugasmu adalah membaca dan mengekstrak data dari struk ini dengan sangat teliti:

1. "merchant": Nama restoran / kafe / toko di bagian paling atas struk.
2. "date": Tanggal struk format YYYY-MM-DD.
3. "lines": Daftar seluruh makanan/minuman yang dipesan. Untuk setiap menu ambil:
   - "name": Nama produk yang jelas dan rapi (bersihkan dari kode barcode atau nomor meja).
   - "qty": Jumlah porsi yang dipesan (angka bulat/integer, default 1).
   - "price": Total harga baris untuk produk tersebut dalam bentuk integer rupiah (misal 35000, BUKAN 35.000).
4. "subtotal": Total harga makanan sebelum pajak dan service (integer rupiah).
5. "tax": Nilai rupiah untuk Pajak Restoran / PB1 / PPN / Tax (contoh 10% atau 11%). Jika tidak ada pajak, beri angka 0.
6. "service": Nilai rupiah untuk Service Charge / SC / Biaya Layanan (contoh 5%). Jika tidak ada service, beri angka 0.
7. "total": Nilai Grand Total / Total Akhir yang harus dibayar (integer rupiah).

ATURAN PENTING:
- Jangan masukkan diskon, kembalian (change), uang tunai (cash), subtotal, pajak, atau service ke dalam array "lines".
- Semua nominal uang ("price", "subtotal", "tax", "service", "total") WAJIB berupa angka integer murni (tanpa titik, koma, atau tulisan "Rp").
- Kembalikan HANYA format JSON valid tanpa tanda markdown:
{
  "merchant": "Nama Restoran",
  "date": "2026-10-31",
  "lines": [
    { "name": "Nasi Goreng Medja", "qty": 1, "price": 35000 },
    { "name": "Es Teh Manis", "qty": 2, "price": 16000 }
  ],
  "subtotal": 51000,
  "service": 2550,
  "tax": 5355,
  "total": 58905
}`;

    const visionModels = [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', noReasoning: false },
      { id: 'qwen/qwen3.8-27b', noReasoning: true },
    ];

    let lastError = '';

    for (const m of visionModels) {
      try {
        this.logger.log(`[Groq AI] Membaca produk, harga, dan pajak dengan model: ${m.id}...`);

        const requestBody: any = {
          model: m.id,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        };

        if (m.noReasoning) {
          requestBody.reasoning_effort = 'none';
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey.trim()}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errBody = await response.text();
          lastError = `Groq (${m.id} HTTP ${response.status}): ${errBody}`;
          this.logger.error(lastError);
          continue;
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;
        const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        this.logger.log(`[Groq Sukses!] Restoran: "${parsed.merchant}", Item terbaca: ${parsed.lines?.length || 0}, Tax: Rp ${parsed.tax || 0}, Service: Rp ${parsed.service || 0}`);

        return {
          merchant: parsed.merchant || 'Struk Belanja',
          date: parsed.date || new Date().toISOString().slice(0, 10),
          lines: (parsed.lines || []).map((l: any) => ({
            name: String(l.name || 'Menu'),
            qty: Number(l.qty) || 1,
            price: Number(l.price) || 0,
          })),
          subtotal: Number(parsed.subtotal) || 0,
          service: Number(parsed.service) || 0,
          tax: Number(parsed.tax) || 0,
          total: Number(parsed.total) || 0,
        };
      } catch (err: any) {
        lastError = err.message;
        this.logger.error(`Error pada model ${m.id}: ${err.message}`);
      }
    }

    throw new BadRequestException(lastError || 'Groq AI tidak dapat membaca struk.');
  }
}