<script setup>
// Lembar pengaturan tampilan: pilih tema warna + nama pemilik tagihan.
import { THEMES, currentTheme, applyTheme } from '../composables/useTheme'

defineProps({ ownerName: { type: String, default: 'Kamu' } })
const emit = defineEmits(['close', 'update:ownerName', 'replay-intro'])
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" @click.self="emit('close')">
    <div class="card rounded-b-none w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[88vh] overflow-y-auto">
      <div class="flex items-start justify-between">
        <div>
          <h4 class="font-display font-bold text-xl text-ink leading-tight">Tampilan</h4>
          <p class="text-[11px] font-semibold text-muted">Pilih warna favoritmu, langsung berubah.</p>
        </div>
        <button class="circle-btn" aria-label="Tutup" @click="emit('close')">✕</button>
      </div>

      <div class="grid grid-cols-2 gap-2.5">
        <button
          v-for="t in THEMES" :key="t.value"
          type="button"
          class="relative text-left rounded-2xl p-3 border-2 transition active:scale-[.97]"
          :class="currentTheme === t.value ? 'border-edge bg-brand-soft shadow-sticker-sm' : 'border-line bg-surface'"
          @click="applyTheme(t.value)"
        >
          <div class="flex gap-1.5 mb-2">
            <span v-for="(c, i) in t.dots" :key="i" class="w-6 h-6 rounded-full border-2 border-edge/70" :style="{ background: c }" />
          </div>
          <p class="font-extrabold text-xs text-ink">{{ t.label }}</p>
          <p class="text-[10px] font-semibold text-muted">{{ t.note }}</p>
          <span v-if="currentTheme === t.value" class="absolute top-2 right-2 text-[10px] font-black bg-brand text-on-brand rounded-full w-5 h-5 flex items-center justify-center">✓</span>
        </button>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider">Namamu (muncul di pesan tagihan)</label>
        <input :value="ownerName" class="field" maxlength="24" placeholder="Kamu" @input="emit('update:ownerName', $event.target.value)" />
      </div>

      <button class="btn-soft w-full py-2.5 text-xs" @click="emit('replay-intro')">👋 Lihat pengenalan lagi</button>
    </div>
  </div>
</template>