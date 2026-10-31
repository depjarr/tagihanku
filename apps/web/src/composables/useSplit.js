// Perhitungan pembagian tagihan (murni, tanpa Vue) — supaya mudah dites.
// Semua nominal bilangan bulat rupiah dan JUMLAH SELALU PAS (metode sisa terbesar), tidak ada selisih Rp 1.

export const SPLIT_MODES = [
  { value: 'equal',   label: 'Rata' },
  { value: 'shares',  label: 'Porsi' },
  { value: 'percent', label: 'Persen' },
  { value: 'amount',  label: 'Nominal' },
]

/** Bagi `total` ke beberapa bobot; hasil integer dan berjumlah tepat `total` (boleh negatif untuk diskon). */
export function distribute(total, weights) {
  const n = weights.length
  const out = new Array(n).fill(0)
  const sum = weights.reduce((a, w) => a + (w > 0 ? w : 0), 0)
  if (!n || sum <= 0 || !Number.isFinite(total) || total === 0) return out
  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(Math.round(total))
  const raw = weights.map((w) => (w > 0 ? (abs * w) / sum : 0))
  const base = raw.map(Math.floor)
  let left = abs - base.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, frac: r - base[i] }))
    .filter((x) => weights[x.i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0 && order.length; k++, left--) base[order[k % order.length].i] += 1
  return base.map((v) => v * sign)
}

/** Bobot tiap anggota untuk satu item (hanya anggota yang masuk `memberIds`). */
export function itemWeights(item, memberIds) {
  const mode = item.splitMode || 'equal'
  if (mode === 'equal') {
    const set = new Set(item.assignedTo || [])
    return memberIds.map((id) => (set.has(id) ? 1 : 0))
  }
  const w = item.weights || {}
  return memberIds.map((id) => Math.max(0, Number(w[id]) || 0))
}

/** { [memberId]: rupiah } untuk satu item. */
export function itemShares(item, memberIds) {
  const parts = distribute(Math.round(Number(item.price) || 0), itemWeights(item, memberIds))
  const res = {}
  memberIds.forEach((id, i) => { res[id] = parts[i] })
  return res
}

/** Anggota yang ikut di item ini (bobot > 0). */
export function itemMembers(item, memberIds) {
  const w = itemWeights(item, memberIds)
  return memberIds.filter((_, i) => w[i] > 0)
}

/** Sisa/kelebihan input pembagian untuk mode persen & nominal (untuk peringatan di UI). */
export function modeBalance(item, memberIds) {
  const mode = item.splitMode || 'equal'
  const sum = itemWeights(item, memberIds).reduce((a, b) => a + b, 0)
  if (mode === 'percent') return { target: 100, sum, diff: 100 - sum, unit: '%' }
  if (mode === 'amount') return { target: Math.round(Number(item.price) || 0), sum, diff: Math.round(Number(item.price) || 0) - sum, unit: 'Rp' }
  return null
}

/**
 * Hitung tagihan tiap anggota.
 * Pajak + service (dikurangi diskon) dibagi sebanding dengan subtotal menu masing-masing.
 * @returns {{ rows: Array, unassigned: Array, assignedTotal: number, grandTotal: number }}
 */
export function computeSplit({ items, memberIds, tax = 0, serviceCharge = 0, discount = 0 }) {
  const rows = memberIds.map((id) => ({ id, itemSubtotal: 0, extra: 0, total: 0, lines: [] }))
  const idx = Object.fromEntries(memberIds.map((id, i) => [id, i]))
  const unassigned = []
  let assignedTotal = 0

  for (const it of items) {
    const price = Math.round(Number(it.price) || 0)
    const shares = itemShares(it, memberIds)
    const got = Object.values(shares).reduce((a, b) => a + b, 0)
    if (got === 0) { if (price > 0) unassigned.push(it); continue }
    assignedTotal += price
    for (const id of memberIds) {
      if (shares[id] > 0) {
        rows[idx[id]].itemSubtotal += shares[id]
        rows[idx[id]].lines.push({ itemId: it.id, name: it.name, amount: shares[id] })
      }
    }
  }

  const extraTotal = (Number(tax) || 0) + (Number(serviceCharge) || 0) - (Number(discount) || 0)
  const extras = distribute(extraTotal, rows.map((r) => r.itemSubtotal))
  rows.forEach((r, i) => { r.extra = extras[i]; r.total = r.itemSubtotal + r.extra })

  return { rows, unassigned, assignedTotal, grandTotal: rows.reduce((a, r) => a + r.total, 0) }
}