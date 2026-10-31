/**
 * Logika hitung porsi — fungsi murni, tanpa dependensi framework, mudah di-test.
 * Semua angka dalam rupiah bulat (integer). Sisa pembulatan dibagikan per 1 rupiah
 * (largest remainder), jadi jumlah porsi SELALU sama dengan total tagihan.
 */
export interface SplitParticipant { id: string; name: string }
export interface SplitItem { id: string; price: number; participantIds: string[] }
export interface SplitInput {
  participants: SplitParticipant[];
  items: SplitItem[];
  taxPercent: number;
  servicePercent: number;
}
export interface PersonShare {
  participantId: string;
  name: string;
  itemTotal: number;
  feeTotal: number; // bagian pajak + service
  total: number;
}
export interface SplitResult {
  shares: PersonShare[];
  subtotal: number;
  assignedSubtotal: number;
  unassignedSubtotal: number;
  unassignedItemIds: string[];
  fee: number; // pajak + service dari seluruh item
  expectedTotal: number; // subtotal + fee (angka di struk)
  grandTotal: number; // jumlah semua porsi
}

/** Bagi `total` sebanding `weights`; hasil bulat dan jumlahnya persis `total`. */
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const S = BigInt(sum);
  const parts = weights.map((w, i) => {
    const num = BigInt(total) * BigInt(w);
    return { i, floor: Number(num / S), frac: num % S };
  });
  let leftover = total - parts.reduce((a, p) => a + p.floor, 0);
  const order = [...parts].sort((a, b) => (a.frac === b.frac ? a.i - b.i : a.frac > b.frac ? -1 : 1));
  const out = parts.map((p) => p.floor);
  for (const p of order) {
    if (leftover <= 0) break;
    out[p.i] += 1;
    leftover -= 1;
  }
  return out;
}

const feeOf = (base: number, taxPercent: number, servicePercent: number) => {
  const bp = Math.round((taxPercent + servicePercent) * 100); // basis point
  return Math.floor((base * bp + 5000) / 10000); // dibulatkan ke rupiah terdekat
};

export function calculateSplit(input: SplitInput): SplitResult {
  const order = input.participants.map((p) => p.id);
  const itemTotals = new Map<string, number>(order.map((id) => [id, 0]));
  const unassignedItemIds: string[] = [];
  let subtotal = 0;
  let assigned = 0;

  for (const item of input.items) {
    subtotal += item.price;
    const ids = order.filter((id) => item.participantIds.includes(id));
    if (ids.length === 0) {
      unassignedItemIds.push(item.id);
      continue;
    }
    assigned += item.price;
    distribute(item.price, ids.map(() => 1)).forEach((amount, i) => {
      itemTotals.set(ids[i], (itemTotals.get(ids[i]) ?? 0) + amount);
    });
  }

  const fees = distribute(
    feeOf(assigned, input.taxPercent, input.servicePercent),
    order.map((id) => itemTotals.get(id) ?? 0),
  );

  const shares: PersonShare[] = input.participants.map((p, i) => {
    const itemTotal = itemTotals.get(p.id) ?? 0;
    return { participantId: p.id, name: p.name, itemTotal, feeTotal: fees[i], total: itemTotal + fees[i] };
  });

  const fee = feeOf(subtotal, input.taxPercent, input.servicePercent);
  return {
    shares,
    subtotal,
    assignedSubtotal: assigned,
    unassignedSubtotal: subtotal - assigned,
    unassignedItemIds,
    fee,
    expectedTotal: subtotal + fee,
    grandTotal: shares.reduce((a, s) => a + s.total, 0),
  };
}
