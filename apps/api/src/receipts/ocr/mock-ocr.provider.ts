import { Injectable } from '@nestjs/common';
import { OcrProvider } from './ocr.provider';

/** Untuk development: selalu mengembalikan struk contoh dari mockup (termasuk salah baca 2.500). */
@Injectable()
export class MockOcrProvider implements OcrProvider {
  async recognize(): Promise<string> {
    return [
      'Warung Makan Sederhana',
      'Nasi Goreng 28.000',
      'Mie Ayam 2.500',
      'Ayam Bakar 42.000',
      'Es Teh x3 15.000',
      'Subtotal 110.000',
      'PB1 10% 11.000',
      'Service 5% 5.500',
      'Total 126.500',
    ].join('\n');
  }
}
