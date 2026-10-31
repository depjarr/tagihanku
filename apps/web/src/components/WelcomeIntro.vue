<script setup>
// Layar pengenalan sebelum masuk ke halaman tagihan.
import { ref } from 'vue'
import CatMascot from './CatMascot.vue'

const emit = defineEmits(['done'])
const page = ref(0)

const PAGES = [
  { emoji: '📷', title: 'Foto struk, AI yang itungin', text: 'Jepret struk makan-makan. Menu, harga, pajak & service dibaca otomatis.' },
  { emoji: '🍰', title: 'Atur pembagian sesukamu', text: 'Bagi rata, per porsi, persen, atau nominal. Tiap orang bebas pilih menunya sendiri.' },
  { emoji: '💬', title: 'Ingetin temen buat bayar', text: 'Kirim tagihan lewat WhatsApp + QRIS. Pencet "sudah lunas" dan struk lunasnya tersimpan khusus untukmu.' },
]
const last = () => page.value === PAGES.length - 1
const next = () => (last() ? emit('done') : page.value++)
</script>

<template>
  <div class="fixed inset-0 z-[60] bg-hero text-hero-ink flex flex-col mx-auto max-w-md overflow-hidden">
    <!-- hiasan -->
    <span class="absolute top-10 left-6 text-3xl animate-bob">🍞</span>
    <span class="absolute top-24 right-7 text-2xl animate-bob" style="animation-delay:.6s">🍩</span>
    <span class="absolute top-[26%] left-5 text-2xl animate-bob" style="animation-delay:1.1s">🍅</span>
    <span class="absolute top-[30%] right-6 text-3xl animate-bob" style="animation-delay:1.6s">🥐</span>

    <div class="flex justify-end p-4 pt-[max(1rem,env(safe-area-inset-top))] z-10">
      <button v-if="!last()" class="text-xs font-extrabold bg-white/15 rounded-full px-3 py-1.5" @click="emit('done')">Lewati</button>
    </div>

    <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 z-10">
      <div class="animate-bob"><CatMascot :size="132" mood="happy" /></div>
      <div class="space-y-1.5">
        <p class="text-xs font-extrabold uppercase tracking-[.25em] opacity-80">Welcome to</p>
        <h1 class="font-display font-bold text-5xl leading-none">Tagihanku!</h1>
        <p class="text-sm font-semibold opacity-90 leading-relaxed max-w-[17rem] mx-auto pt-1">
          Kamu bisa split bill di sini dan ingetin temen untuk bayar tagihan.
        </p>
      </div>
    </div>

    <div class="bg-page text-ink rounded-t-[2rem] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5 border-t-2 border-edge z-10">
      <div class="gingham rounded-3xl border-2 border-edge p-4 text-center space-y-1 min-h-[132px] flex flex-col justify-center">
        <span class="text-3xl">{{ PAGES[page].emoji }}</span>
        <h3 class="font-display font-bold text-lg text-ink">{{ PAGES[page].title }}</h3>
        <p class="text-xs font-semibold text-muted leading-relaxed">{{ PAGES[page].text }}</p>
      </div>

      <div class="flex items-center justify-between">
        <div class="flex gap-1.5">
          <span v-for="(_, i) in PAGES" :key="i" class="h-2 rounded-full transition-all" :class="i === page ? 'w-6 bg-brand' : 'w-2 bg-line'" />
        </div>
        <button class="btn-primary px-6 py-3 text-sm" @click="next">{{ last() ? 'Mulai! 🎉' : 'Lanjut ›' }}</button>
      </div>
    </div>
  </div>
</template>