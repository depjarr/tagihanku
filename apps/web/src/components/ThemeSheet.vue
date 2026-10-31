<script setup>
// Lembar tampilan di beranda: pilih warna utama + mode (terang/gelap/sistem) + nama pembuat tagihan.
// Pilihan langsung berubah dan tersimpan (tamu: di perangkat ini; login: ikut ke akun).
import { ACCENTS, MODES } from '../composables/useAccent'
import { useAuthStore } from '../stores/authStore'
import { toast } from '../composables/useToast'

defineProps({ modelValue: { type: String, default: 'Kamu' } }) // dipakai lewat v-model="ownerName"
const emit = defineEmits(['close', 'update:modelValue', 'replay-intro'])

const auth = useAuthStore()

async function pick(patch) {
  try { await auth.saveSettings(patch) } catch { toast.info('Tampilan belum bisa disimpan ke akunmu, coba lagi ya.') }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" @click.self="emit('close')">
    <div class="card rounded-b-none w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[88vh] overflow-y-auto">
      <div class="flex items-start justify-between">
        <div>
          <h4 class="font-display font-bold text-xl text-ink leading-tight">Tampilan</h4>
          <p class="text-[11px] font-semibold text-muted">Pilih warna dan mode, langsung berubah.</p>
        </div>
        <button class="circle-btn" aria-label="Tutup" @click="emit('close')">✕</button>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider">Warna utama</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="c in ACCENTS" :key="c.value" type="button"
            class="relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 transition active:scale-[.97]"
            :class="auth.settings.accent === c.value ? 'border-edge bg-brand-soft shadow-sticker-sm' : 'border-line bg-surface'"
            :aria-pressed="auth.settings.accent === c.value"
            @click="pick({ accent: c.value })"
          >
            <span class="h-8 w-8 rounded-full border-2 border-edge/70" :style="{ background: c.swatch }" />
            <span class="text-xs font-extrabold text-ink">{{ c.label }}</span>
            <span v-if="auth.settings.accent === c.value" class="absolute top-1.5 right-1.5 text-[10px] font-black bg-brand text-on-brand rounded-full w-5 h-5 flex items-center justify-center">✓</span>
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider">Mode</label>
        <div class="flex gap-2">
          <button
            v-for="m in MODES" :key="m.value" type="button"
            class="h-10 flex-1 rounded-full border-2 text-xs font-extrabold transition active:scale-[.97]"
            :class="auth.settings.theme === m.value ? 'border-edge bg-brand text-on-brand' : 'border-line bg-surface text-ink'"
            :aria-pressed="auth.settings.theme === m.value"
            @click="pick({ theme: m.value })"
          >{{ m.label }}</button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider">Namamu (muncul di pesan tagihan)</label>
        <input :value="modelValue" class="field" maxlength="24" placeholder="Kamu" @input="emit('update:modelValue', $event.target.value)" />
      </div>

      <button class="btn-soft w-full py-2.5 text-xs" @click="emit('replay-intro')">👋 Lihat pengenalan lagi</button>
    </div>
  </div>
</template>