<script setup>
// Maskot kucing hitam (gaya ilustrasi referensi). SVG murni, warna latar mengikuti tema.
defineProps({
  size: { type: Number, default: 96 },
  mood: { type: String, default: 'hi' }, // 'hi' | 'happy' | 'sleep'
  bare: { type: Boolean, default: false }, // true = tanpa lingkaran latar
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 120 120" role="img" aria-label="Maskot kucing">
    <circle v-if="!bare" cx="60" cy="60" r="58" style="fill: rgb(var(--cat-bg))" />
    <!-- telinga -->
    <path d="M24 52 L30 20 L52 38 Z" fill="#1b1a1f" />
    <path d="M96 52 L90 20 L68 38 Z" fill="#1b1a1f" />
    <path d="M32 40 L34 28 L44 36 Z" fill="#e0675f" opacity=".85" />
    <path d="M88 40 L86 28 L76 36 Z" fill="#e0675f" opacity=".85" />
    <!-- kepala -->
    <ellipse cx="60" cy="66" rx="40" ry="35" fill="#1b1a1f" />
    <!-- mata -->
    <template v-if="mood !== 'sleep'">
      <ellipse cx="44" cy="62" rx="10" ry="11" fill="#fff" />
      <ellipse cx="76" cy="62" rx="10" ry="11" fill="#fff" />
      <circle cx="46" cy="64" r="5.5" fill="#2f6fd0" />
      <circle cx="74" cy="64" r="5.5" fill="#2f6fd0" />
      <circle cx="47.5" cy="62" r="1.8" fill="#fff" />
      <circle cx="75.5" cy="62" r="1.8" fill="#fff" />
    </template>
    <template v-else>
      <path d="M34 64 Q44 72 54 64" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" />
      <path d="M66 64 Q76 72 86 64" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" />
    </template>
    <!-- pipi, hidung, mulut -->
    <ellipse cx="30" cy="78" rx="6" ry="3.5" fill="#e0675f" opacity=".55" />
    <ellipse cx="90" cy="78" rx="6" ry="3.5" fill="#e0675f" opacity=".55" />
    <ellipse cx="60" cy="74" rx="4.5" ry="3.2" fill="#e0412f" />
    <path v-if="mood === 'happy'" d="M50 80 Q60 92 70 80 Z" fill="#e0412f" />
    <path v-else d="M60 77 Q60 84 53 84 M60 77 Q60 84 67 84" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" />
    <!-- kumis -->
    <path d="M14 70 L28 72 M14 80 L28 78 M106 70 L92 72 M106 80 L92 78" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".6" />
  </svg>
</template>