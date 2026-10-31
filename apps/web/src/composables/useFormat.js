const nf = new Intl.NumberFormat('id-ID')

export const rupiah = (n) => `Rp ${nf.format(Math.round(Number(n) || 0))}`
export const number = (n) => nf.format(Math.round(Number(n) || 0))
/** "28.000" / "Rp 28000" → 28000 */
export const toInt = (s) => Number(String(s ?? '').replace(/\D/g, '')) || 0

export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
export const todayISO = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD, zona waktu lokal
export const shareUrl = (code) => `${location.origin}/s/${code}`

/** Tanggal + jam singkat, mis. "8 Okt, 12.40". */
export function formatDateTime(iso) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}, ${hh}.${mm}`
}

/**
 * Satu kolom "Pajak + service": "10% + 5%", "10+5", "11" (service 0), "10 5" → { tax, service }.
 * Angka di luar 0–100 dibatasi; koma desimal diterima ("7,5").
 */
export function parseTaxService(text) {
  const nums = String(text ?? '').replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) || []
  const fix = (n) => Math.min(100, Math.max(0, Math.round((Number(n) || 0) * 100) / 100))
  return { tax: fix(nums[0]), service: fix(nums[1]) }
}
export const formatTaxService = (tax, service) => `${tax}% + ${service}%`
