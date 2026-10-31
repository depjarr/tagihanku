/** Warna = variabel CSS di style.css, jadi tema (mode x aksen) bisa berganti tanpa build ulang. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { DEFAULT: v('brand'), soft: v('brand-soft'), ink: v('brand-ink') },
        'on-brand': v('on-brand'),
        accent: { DEFAULT: v('accent'), soft: v('accent-soft') },
        sun: { DEFAULT: v('sun'), soft: v('sun-soft') },
        hero: { DEFAULT: v('hero'), ink: v('hero-ink') },
        ok: { DEFAULT: v('ok'), soft: v('ok-soft'), ink: v('ok-ink') },
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        edge: v('edge'),
        page: v('page'),
        surface: v('surface'),
        warn: { DEFAULT: v('warn'), soft: v('warn-soft'), ink: v('warn-ink') },
        danger: v('danger'),
      },
      boxShadow: {
        sticker: '0 4px 0 0 rgb(var(--edge))',
        'sticker-sm': '0 2px 0 0 rgb(var(--edge))',
      },
    },
  },
}