/** Kontrak OCR. Ganti implementasi (Tesseract, Google Vision, AWS Textract, dll.) tanpa menyentuh service lain. */
export interface OcrProvider {
  /** Mengembalikan teks mentah dari gambar struk, satu baris struk = satu baris teks. */
  recognize(image: Buffer, mimeType: string): Promise<string>;
}
export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
