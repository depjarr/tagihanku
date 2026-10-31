// Tema warna. Nilai warna tiap tema ada di src/style.css (blok :root[data-theme='...']).
// Mau tambah tema? 1) salin satu blok di style.css  2) tambahkan satu baris di THEMES di bawah.
import { ref } from 'vue'

export const THEMES = [
  { value: 'roti',     label: 'Roti Kucing', note: 'Krem + biru laut',  dots: ['#1D4E8C', '#C8302A', '#F2A924'], bar: '#1A457D' },
  { value: 'kue',      label: 'Kue Biru',    note: 'Biru bubuk manis',  dots: ['#6896C4', '#B23638', '#ECC462'], bar: '#7FAAD4' },
  { value: 'stroberi', label: 'Stroberi',    note: 'Pink segar',        dots: ['#D64660', '#BE2846', '#F6BE5A'], bar: '#D64660' },
  { value: 'matcha',   label: 'Matcha',      note: 'Hijau tenang',      dots: ['#548C52', '#CE5634', '#E8B83A'], bar: '#3A7042' },
  { value: 'donat',    label: 'Donat',       note: 'Oranye hangat',     dots: ['#E27822', '#C03428', '#F4BE3C'], bar: '#E27822' },
  { value: 'malam',    label: 'Malam',       note: 'Mode gelap',        dots: ['#F2B034', '#F07064', '#263A68'], bar: '#141A28' },
]
export const DEFAULT_THEME = 'roti'
export const THEME_STORAGE_KEY = 'tagihanku_theme'

export const currentTheme = ref(DEFAULT_THEME)

export function applyTheme(value) {
  const t = THEMES.find((x) => x.value === value) || THEMES[0]
  currentTheme.value = t.value
  document.documentElement.setAttribute('data-theme', t.value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bar)
  try { localStorage.setItem(THEME_STORAGE_KEY, t.value) } catch { /* mode privat */ }
}

export function initTheme() {
  let saved = DEFAULT_THEME
  try { saved = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME } catch { /* mode privat */ }
  applyTheme(saved)
}