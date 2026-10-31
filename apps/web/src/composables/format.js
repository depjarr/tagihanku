// Format tampilan (Rupiah, tanggal) untuk alur split bill.
export const formatRupiah = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** '2026-10-31' atau ISO -> '31 Okt 2026' */
export function formatDate(value) {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return value || '-'
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

/** ISO -> '31 Okt 2026, 14.05' */
export function formatDateTime(value) {
  const d = value ? new Date(value) : null
  if (!d || Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(d)}, ${hh}.${mm}`
}

/** Nomor struk unik & mudah dibaca, mis. LNS-251031-K3F9 */
export function makeReceiptNo(date = new Date()) {
  const y = String(date.getFullYear()).slice(2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `LNS-${y}${m}${d}-${rand}`
}