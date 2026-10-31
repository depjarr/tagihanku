import { parseReceipt, parseRupiah } from './receipt-parser';

describe('parseRupiah', () => {
  it('membaca format Indonesia', () => {
    expect(parseRupiah('28.000')).toBe(28000);
    expect(parseRupiah('Rp 126.500')).toBe(126500);
    expect(parseRupiah('15,000')).toBe(15000);
    expect(parseRupiah('28.000,00')).toBe(28000);
    expect(parseRupiah('abc')).toBeNaN();
  });
});

describe('parseReceipt', () => {
  const text = `Warung Makan Sederhana\n08/10/2026\nNasi Goreng 28.000\nMie Ayam 2.500\nAyam Bakar 42.000\n3 Es Teh 15.000\nSubtotal 110.000\nPB1 10% 11.000\nService 5% 5.500\nTotal 126.500\nTunai 150.000`;

  it('membaca item, subtotal, total, dan tanggal', () => {
    const r = parseReceipt(text);
    expect(r.merchant).toBe('Warung Makan Sederhana');
    expect(r.date).toBe('2026-10-08');
    expect(r.lines.map((l) => l.name)).toEqual(['Nasi Goreng', 'Mie Ayam', 'Ayam Bakar', 'Es Teh x3']);
    expect(r.subtotal).toBe(110000);
    expect(r.total).toBe(126500);
    expect(r.tax).toBe(11000);
    expect(r.service).toBe(5500);
    expect(r.taxPercent).toBe(10);
    expect(r.servicePercent).toBe(5);
  });

  it('menandai harga mencurigakan dan selisih subtotal', () => {
    const r = parseReceipt(text);
    expect(r.lines[1]).toMatchObject({ suspicious: true, suggestedPrice: 25000 });
    expect(r.itemsSum).toBe(87500);
    expect(r.mismatch).toBe(22500);
  });

  it('tahan format struk lain: "2 x", "Rp", koma-minus, O jadi 0, nomor telepon', () => {
    const r = parseReceipt(
      `RM PADANG SALERO\nJl. Merdeka No. 5\n0812-3456-7890\n8 Okt 2026\n1 x Rendang Rp 32.000\n2 x Ayam Pop 56.000\nEs Teh Manis 2 x 6.000 12.000\nNasi Putih 15.OOO\nSub Total 115.000\nPajak PB1 (10%) 11.500\nTotal Rp 126.500,-`,
    );
    expect(r.lines.map((l) => [l.name, l.price])).toEqual([
      ['Rendang', 32000], ['Ayam Pop x2', 56000], ['Es Teh Manis x2', 12000], ['Nasi Putih', 15000],
    ]);
    expect(r.mismatch).toBe(0);
    expect(r.total).toBe(126500);
    expect(r.taxPercent).toBe(10);
    expect(r.servicePercent).toBe(0);
  });

  it('nama item di baris atas dan harga di baris bawah', () => {
    const r = parseReceipt(`KOPI\nKopi Susu Gula Aren\n2 x 18.000 36.000\nSubtotal 36.000\nTotal 36.000`);
    expect(r.lines.map((l) => [l.name, l.price])).toEqual([['Kopi Susu Gula Aren x2', 36000]]);
    expect(r.taxPercent).toBe(0);
  });

  it('persen pajak dihitung dari nominal agar total cocok dengan struk', () => {
    const r = parseReceipt(`Resto\nUdang Bakar 100.000\nSubtotal 100.000\nService 5% 5.000\nPB1 10% 10.500\nTotal 115.500`);
    expect(r.servicePercent).toBe(5);
    expect(r.taxPercent).toBe(10.5);
  });

  it('teks kosong / noise tidak menghasilkan item', () => {
    expect(parseReceipt('ii\n--\n1').lines).toEqual([]);
  });
});
