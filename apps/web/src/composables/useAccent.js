// Mode (terang/gelap/sistem) x aksen (6 warna pastel). Nilai warna ada di src/style.css.
// Daftar `value` harus sama dengan ACCENTS di apps/api/src/settings/dto/settings.dto.ts.
export const ACCENTS = [
  { value: 'biru', label: 'Biru', swatch: '#BBD6F5', ink: '#153A66', soft: '#EAF2FC' },
  { value: 'merah', label: 'Merah', swatch: '#F6C1C1', ink: '#7A1F1F', soft: '#FDF0F0' },
  { value: 'kuning', label: 'Kuning', swatch: '#FBE7A1', ink: '#5E4700', soft: '#FEF8DD' },
  { value: 'hijau', label: 'Hijau', swatch: '#BFE3CF', ink: '#0F4D33', soft: '#EDF8F2' },
  { value: 'ungu', label: 'Ungu', swatch: '#D8CBF2', ink: '#3F2A73', soft: '#F4EFFC' },
  { value: 'peach', label: 'Peach', swatch: '#F9D3B4', ink: '#7A3E10', soft: '#FEF3EA' },
  // tema paket (ubah warna dasar, halaman, dan gaya) — kind: 'tema'
  { value: 'kidcore', kind: 'tema', label: 'Kidcore', note: 'Warna-warni ceria', swatch: 'linear-gradient(135deg,#2563EB 25%,#FACC15 0 50%,#DC2626 0 75%,#65A30D 0)', meta: '#2563EB', ink: '#122A8C', soft: '#FFF6CC' },
  { value: 'pixel', kind: 'tema', label: 'Pixel', note: 'Retro 8-bit', swatch: 'linear-gradient(135deg,#0F380F 25%,#306230 0 50%,#8BAC0F 0 75%,#E0F8D0 0)', meta: '#306230', ink: '#0F380F', soft: '#E0F8D0' },
  { value: 'fairy', kind: 'tema', label: 'Fairy', note: 'Pastel berkilau', swatch: 'linear-gradient(135deg,#F9A8D4,#C4B5FD 50%,#A7F3D0)', meta: '#C4B5FD', ink: '#4A2C6E', soft: '#F5EBFF' },
  { value: 'apple', kind: 'tema', label: 'Apple', note: 'Merah & hijau apel', swatch: 'linear-gradient(135deg,#D02618 33%,#B5D14C 0 66%,#F5DE8F 0)', meta: '#D02618', ink: '#910608', soft: '#FDE8E2' },
]
export const MODES = [
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
  { value: 'system', label: 'Sistem' },
]
export const DEFAULT_ACCENT = 'biru' // ganti di sini kalau mau warna awal lain (juga di index.html + DB default)
export const THEME_KEY = 'splitbill.theme'
export const ACCENT_KEY = 'splitbill.accent'

export const accentOf = (value) => ACCENTS.find((a) => a.value === value) || ACCENTS[0]
export const modeLabel = (value) => MODES.find((m) => m.value === value)?.label || 'Terang'
export const describeLook = (accent, theme) => {
  const a = accentOf(accent)
  return `${a.label}${a.kind === 'tema' ? '' : ' pastel'} · ${modeLabel(theme)}`
}

export const isDark = (theme) =>
  theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)

/** Terapkan tampilan ke seluruh aplikasi: kelas `dark` + atribut data-accent di <html>. */
export function applyAppearance({ theme, accent }) {
  const root = document.documentElement
  const a = accentOf(accent)
  root.classList.toggle('dark', isDark(theme))
  root.dataset.accent = a.value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark(theme) ? '#0D1117' : a.meta || a.swatch)
}