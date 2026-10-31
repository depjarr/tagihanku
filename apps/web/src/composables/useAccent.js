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
  { value: 'pixel', kind: 'tema', label: 'Pixel', note: 'Retro 8-bit', swatch: 'linear-gradient(135deg,#240C38 14%,#7A1E8A 0 28%,#C8286E 0 42%,#FF7800 0 56%,#FFC800 0 70%,#2E7A14 0 84%,#FFE8A0 0)', meta: '#601878', ink: '#240C38', soft: '#FFF0C8' },
  { value: 'fairy', kind: 'tema', label: 'Fairy', note: 'Pastel berkilau', swatch: 'linear-gradient(135deg,#F9A8D4,#C4B5FD 50%,#A7F3D0)', meta: '#C4B5FD', ink: '#4A2C6E', soft: '#F5EBFF' },
  { value: 'apple', kind: 'tema', label: 'Apple', note: 'Merah & hijau apel', swatch: 'linear-gradient(135deg,#D02618 33%,#B5D14C 0 66%,#F5DE8F 0)', meta: '#D02618', ink: '#910608', soft: '#FDE8E2' },
  // palet merah (3 warna per tema) — kind: 'palet'
  { value: 'cherry', kind: 'palet', label: 'Cherry', colors: ['#D63241', '#FFC0C3', '#9AC9DA'], swatch: 'linear-gradient(135deg,#D63241 33%,#FFC0C3 0 66%,#9AC9DA 0)', meta: '#D63241', ink: '#3C0E12', soft: '#F9E2E4' },
  { value: 'ruby', kind: 'palet', label: 'Ruby', colors: ['#A40024', '#B3DEE1', '#DCE1DE'], swatch: 'linear-gradient(135deg,#A40024 33%,#B3DEE1 0 66%,#DCE1DE 0)', meta: '#A40024', ink: '#2E000A', soft: '#F2DBE0' },
  { value: 'coral', kind: 'palet', label: 'Coral', colors: ['#EF6A6A', '#D0D686', '#E6A298'], swatch: 'linear-gradient(135deg,#EF6A6A 33%,#D0D686 0 66%,#E6A298 0)', meta: '#EF6A6A', ink: '#431E1E', soft: '#FDEAEA' },
  { value: 'brick', kind: 'palet', label: 'Brick', colors: ['#CD483B', '#768BAB', '#F9F6E0'], swatch: 'linear-gradient(135deg,#CD483B 33%,#768BAB 0 66%,#F9F6E0 0)', meta: '#CD483B', ink: '#391411', soft: '#F8E5E4' },
  { value: 'poppy', kind: 'palet', label: 'Poppy', colors: ['#E04333', '#E5C8F1', '#68BCF1'], swatch: 'linear-gradient(135deg,#E04333 33%,#E5C8F1 0 66%,#68BCF1 0)', meta: '#E04333', ink: '#3F130E', soft: '#FBE5E2' },
  { value: 'tomato', kind: 'palet', label: 'Tomato', colors: ['#D05945', '#DFF671', '#99A9F7'], swatch: 'linear-gradient(135deg,#D05945 33%,#DFF671 0 66%,#99A9F7 0)', meta: '#D05945', ink: '#3A1913', soft: '#F8E8E5' },
  { value: 'garnet', kind: 'palet', label: 'Garnet', colors: ['#A01A1A', '#D6D1C6', '#EAC15C'], swatch: 'linear-gradient(135deg,#A01A1A 33%,#D6D1C6 0 66%,#EAC15C 0)', meta: '#A01A1A', ink: '#2D0707', soft: '#F2DFDF' },
  { value: 'holly', kind: 'palet', label: 'Holly', colors: ['#600505', '#546725', '#FCEDB3'], swatch: 'linear-gradient(135deg,#600505 33%,#546725 0 66%,#FCEDB3 0)', meta: '#600505', ink: '#1B0101', soft: '#E9DCDC' },
  { value: 'cocoa', kind: 'palet', label: 'Cocoa', colors: ['#CA422E', '#59443B', '#9E7961'], swatch: 'linear-gradient(135deg,#CA422E 33%,#59443B 0 66%,#9E7961 0)', meta: '#CA422E', ink: '#39120D', soft: '#F8E5E2' },
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
  return `${a.label}${a.kind ? '' : ' pastel'} · ${modeLabel(theme)}`
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