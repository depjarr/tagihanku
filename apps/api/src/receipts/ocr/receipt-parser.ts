/** Mengubah teks mentah hasil OCR menjadi baris item + total + pajak/service. Fungsi murni (mudah di-test). */
export interface ParsedLine {
  name: string;
  price: number; // total baris (rupiah)
  qty: number;
  suspicious: boolean; // harga terlalu kecil → mungkin angka nol terpotong
  suggestedPrice?: number;
}
export interface ParsedReceipt {
  merchant?: string;
  /** Tanggal di struk, format YYYY-MM-DD. */
  date?: string;
  lines: ParsedLine[];
  subtotal?: number;
  tax?: number;
  service?: number;
  total?: number;
  /** Persen pajak/service terhadap subtotal (dari nominal di struk, jadi total tagihan cocok dengan struk). */
  taxPercent?: number;
  servicePercent?: number;
  itemsSum: number;
  /** subtotal di struk − jumlah item; null bila subtotal tidak terbaca. 0 = cocok. */
  mismatch: number | null;
}

/** "Rp 28.000" / "28,000" / "28.000,00" → 28000 ; selain itu NaN */
export function parseRupiah(raw: string): number {
  const s = raw.replace(/rp\.?/i, '').replace(/\s/g, '').replace(/[.,]00$/, '');
  return /^\d{1,3}([.,]\d{3})+$|^\d+$/.test(s) ? Number(s.replace(/[.,]/g, '')) : NaN;
}

// nominal uang: 28.000 / 1.250.000 / 28000 / Rp 28.000 (angka < 1.000 tanpa "Rp" dianggap bukan harga)
const MONEY = /(?<![\d/]|\d-)(?:rp\.?\s*)?(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|[1-9]\d{3,}(?:[.,]\d{2})?)(?!\d)/gi;

const SKIP =
  /(tunai|cash|kembali|change|bayar\b|debit|kartu|card|qris|kasir|cashier|meja|table|struk|invoice|receipt|terima kasih|thank|telp|tel\b|npwp|wifi|password|order|antrian|queue|diskon|discount|potongan|promo|voucher|pembulatan|rounding|jumlah item|total item|total qty|item\(s\))/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8,
  sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

/** Merapikan salah baca OCR yang umum sebelum diurai. */
function normalizeLine(line: string): string {
  let s = line.replace(/[|_~`]/g, ' ').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  // "28. 000" / "28 .000" → "28.000"
  s = s.replace(/(\d)[.,]\s+(\d{3})(?!\d)/g, '$1.$2').replace(/(\d)\s+[.,](\d{3})(?!\d)/g, '$1.$2');
  // huruf O/o di dalam token angka ("28.OOO") → 0
  s = s.replace(/\s*@\s*(?=\d|rp)/gi, ' x '); // "2 @14.000" → "2 x 14.000"
  s = s
    .split(' ')
    .map((tok) => (/\d/.test(tok) && /^[\dOo.,]+$/.test(tok) ? tok.replace(/[Oo]/g, '0') : tok))
    .join(' ');
  return s;
}

function parseDate(line: string): string | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ok = (y: number, m: number, d: number) =>
    y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : undefined;
  let m = line.match(/\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})\b/);
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return ok(y, Number(m[2]), Number(m[1]));
  }
  m = line.match(/\b(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})\b/);
  if (m) return ok(Number(m[1]), Number(m[2]), Number(m[3]));
  m = line.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})\b/i);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return ok(Number(m[3]), mon, Number(m[1]));
  }
  return undefined;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Persen dari nominal; kalau selisihnya kecil dengan persen yang tertulis di struk, pakai yang tertulis. */
function percentOf(amount: number | undefined, base: number, labeled?: number): number | undefined {
  if (amount === undefined || !base) return undefined;
  const derived = round2((amount / base) * 100);
  if (derived < 0 || derived > 100) return labeled;
  return labeled !== undefined && Math.abs(derived - labeled) < 0.3 ? labeled : derived;
}

export function parseReceipt(text: string): ParsedReceipt {
  const result: ParsedReceipt = { lines: [], itemsSum: 0, mismatch: null };
  const rawLines = text.split(/\r?\n/).map(normalizeLine).filter(Boolean);

  const totals: number[] = [];
  let taxLabeled: number | undefined;
  let serviceLabeled: number | undefined;
  let pendingName = ''; // baris nama tanpa harga (harga ada di baris berikutnya)
  let pendingIdx = -2;
  let seenItem = false;

  const pctIn = (s: string) => {
    const m = s.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return m ? Number(m[1].replace(',', '.')) : undefined;
  };

  rawLines.forEach((line, idx) => {
    const dateHere = parseDate(line);
    if (dateHere) {
      if (!result.date) result.date = dateHere;
      return; // baris tanggal tidak pernah berisi item
    }

    const amounts = [...line.matchAll(MONEY)];
    // nominal harus berada di akhir baris (boleh diikuti "-", "*", ",-", "Rp", spasi)
    const last = amounts[amounts.length - 1];
    const tailOk = !!last && /^[\s\-*.:=,]*(?:rp\.?)?[\s\-*.:=,]*$/i.test(line.slice((last.index ?? 0) + last[0].length));
    if (!last || !tailOk) {
      // baris tanpa harga: calon nama merchant atau nama item yang harganya di baris berikutnya
      const letters = (line.match(/[a-z]/gi) || []).length;
      const isNoise = letters < 3 || letters / line.length < 0.5;
      if (!isNoise && !SKIP.test(line)) {
        if (!result.merchant && !seenItem && idx < 6) result.merchant = line;
        else { pendingName = line; pendingIdx = idx; }
      }
      return;
    }

    const total = parseRupiah(last[0]);
    if (Number.isNaN(total) || total <= 0 || total > 100_000_000) return;
    const prevAmt = amounts.length > 1 ? amounts[amounts.length - 2] : undefined;
    const prev = prevAmt ? parseRupiah(prevAmt[0]) : NaN; // harga satuan?
    const cut = prevAmt && !Number.isNaN(prev) ? prevAmt.index : last.index;
    let label = line.slice(0, cut).replace(/[\s.:=*-]+$/, '').trim();
    const key = label.toLowerCase();

    if (/(total\s*(item|qty|barang|pesanan)|jumlah\s*(item|qty|barang))/.test(key)) return;
    if (/sub\s*-?\s*total/.test(key)) { result.subtotal = total; return; }
    if (/(^|\s)(grand\s*)?total\b|^jumlah\s*(bayar|total)?$|amount\s*due/.test(key)) { totals.push(total); return; }
    if (/(pb\s*-?\s*1|pajak|\btax\b|ppn|pjk)/.test(key)) {
      result.tax = (result.tax ?? 0) + total;
      taxLabeled = taxLabeled ?? pctIn(label);
      return;
    }
    if (/(service|servis|\bsvc\b|\bsrv\b|s\.?\s?charge)/.test(key)) {
      result.service = (result.service ?? 0) + total;
      serviceLabeled = serviceLabeled ?? pctIn(label);
      return;
    }
    if (SKIP.test(key)) return;

    // ---- baris item ----
    let name = label;
    let qty = 1;
    const qtyLead = name.match(/^(\d{1,2})\s*[xX](?![a-z])\s*(.*)$/); // "2 x Nasi Goreng" / "2 x"
    const qtyLeadBare = name.match(/^(\d{1,2})\s+(\D.*)$/); // "3 Es Teh"
    const qtyTrail = name.match(/^(.+?)\s+[xX]\s*(\d{1,2})$/); // "Es Teh x3"
    const qtyTrailX = name.match(/^(.+?)\s+(\d{1,2})\s*[xX]$/); // "Nasi Goreng 2 x"
    if (qtyLead) { qty = Number(qtyLead[1]); name = qtyLead[2]; }
    else if (qtyLeadBare) { qty = Number(qtyLeadBare[1]); name = qtyLeadBare[2]; }
    else if (qtyTrail) { qty = Number(qtyTrail[2]); name = qtyTrail[1]; }
    else if (qtyTrailX) { qty = Number(qtyTrailX[2]); name = qtyTrailX[1]; }
    else if (/^.+\s1$/.test(name)) name = name.replace(/\s1$/, ''); // "Nasi Goreng 1   28.000"
    else if (!Number.isNaN(prev)) {
      const t = name.match(/^(.+?)\s+(\d{1,2})$/); // "Nasi Goreng 2   14.000   28.000"
      if (t && Math.round(total / prev) === Number(t[2])) { name = t[1]; qty = Number(t[2]); }
    }
    if (!Number.isNaN(prev) && prev > 0 && qty === 1) {
      const q = Math.round(total / prev); // "Nasi Goreng 14.000 28.000" (tanpa tanda x)
      if (q > 1 && q <= 99 && Math.abs(q * prev - total) <= q) qty = q;
    }
    name = name.replace(/[\s.:=*-]+$/, '').replace(/^[\s.:=*-]+/, '').trim();

    // nama di baris sebelumnya ("Nasi Goreng" lalu "2 x 14.000   28.000")
    if (!/[a-z]{2,}/i.test(name)) {
      const bare = /^(\d{1,2}\s*[xX]?)?$/.test(label.replace(/\s+/g, ' ').trim());
      if (!pendingName || pendingIdx !== idx - 1 || !bare) return;
      name = pendingName;
    }
    pendingName = '';
    if ((name.match(/[a-z]/gi) || []).length < 2) return;

    seenItem = true;
    if (qty > 1) name = `${name} x${qty}`;
    const suspicious = total < 5000;
    result.lines.push({ name, price: total, qty, suspicious, suggestedPrice: suspicious ? total * 10 : undefined });
  });

  // total: yang terbesar; kalau ada dua "total" dan subtotal belum ada, yang lebih kecil = subtotal
  if (totals.length) {
    result.total = Math.max(...totals);
    const smaller = totals.filter((t) => t < (result.total as number));
    if (result.subtotal === undefined && smaller.length) result.subtotal = Math.max(...smaller);
  }

  result.itemsSum = result.lines.reduce((a, l) => a + l.price, 0);
  if (result.subtotal !== undefined) result.mismatch = result.subtotal - result.itemsSum;

  // ---- persen pajak & service supaya total tagihan = total di struk ----
  const base =
    result.subtotal ??
    (result.total !== undefined ? result.total - (result.tax ?? 0) - (result.service ?? 0) : undefined) ??
    result.itemsSum;
  if (base && base > 0) {
    if (result.subtotal !== undefined && result.total !== undefined) {
      // biaya yang labelnya tidak terbaca tetap dihitung agar total cocok
      const rest = result.total - result.subtotal - (result.tax ?? 0) - (result.service ?? 0);
      if (rest > 0 && rest / base <= 0.3) {
        if (result.service === undefined && result.tax !== undefined) result.service = rest;
        else if (result.tax === undefined) result.tax = rest;
      }
      if (result.tax === undefined && result.service === undefined && result.total === result.subtotal) {
        result.tax = 0;
        result.service = 0;
      }
    }
    result.taxPercent = percentOf(result.tax ?? (result.service !== undefined ? 0 : undefined), base, taxLabeled);
    result.servicePercent = percentOf(result.service ?? (result.tax !== undefined ? 0 : undefined), base, serviceLabeled);
  }
  return result;
}
