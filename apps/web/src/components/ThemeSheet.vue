<script setup>
// Lembar tampilan di beranda: pilih warna utama + mode (terang/gelap/sistem) + nama pembuat tagihan.
// Pilihan langsung berubah dan tersimpan (tamu: di perangkat ini; login: ikut ke akun).
import { computed } from 'vue'
import { ACCENTS, MODES } from '../composables/useAccent'
import { useAuthStore } from '../stores/authStore'
import { toast } from '../composables/useToast'

const props = defineProps({ modelValue: { type: String, default: undefined } }) // v-model = nama pembuat (hanya di beranda)
const hasName = computed(() => props.modelValue !== undefined)
const emit = defineEmits(['close', 'update:modelValue', 'replay-intro'])

const auth = useAuthStore()

const groups = [
  { title: 'Warna utama', cols: 'grid-cols-3', items: ACCENTS.filter((a) => !a.kind) },
  { title: 'Tema seru', cols: 'grid-cols-2', items: ACCENTS.filter((a) => a.kind === 'tema') },
  { title: 'Palet merah', cols: 'grid-cols-3', items: ACCENTS.filter((a) => a.kind === 'palet') },
]

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

      <div v-for="g in groups" :key="g.title" class="space-y-1.5">
        <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider">{{ g.title }}</label>
        <div class="grid gap-2" :class="g.cols">
          <button
            v-for="c in g.items" :key="c.value" type="button"
            class="relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 transition active:scale-[.97]"
            :class="auth.settings.accent === c.value ? 'border-edge bg-brand-soft shadow-sticker-sm' : 'border-line bg-surface'"
            :aria-pressed="auth.settings.accent === c.value"
            @click="pick({ accent: c.value })"
          >
            <span v-if="c.colors" class="flex flex-col items-center">
              <span v-for="(col, i) in c.colors" :key="i" class="h-7 w-7 rounded-full border border-edge/30" :class="i ? '-mt-2.5' : ''" :style="{ background: col, opacity: .93 }" />
            </span>
            <span v-else class="h-8 w-8 rounded-full border-2 border-edge/70" :style="{ background: c.swatch }" />
            <span class="text-xs font-extrabold text-ink">{{ c.label }}</span>
            <span v-if="c.note" class="-mt-1 text-[10px] font-semibold text-muted">{{ c.note }}</span>
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

      <div v-if="hasName" class="space-y-1.5">
        <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider">Namamu (muncul di pesan tagihan)</label>
        <input :value="modelValue" class="field" maxlength="24" placeholder="Kamu" @input="emit('update:modelValue', $event.target.value)" />
      </div>

      <button v-if="hasName" class="btn-soft w-full py-2.5 text-xs" @click="emit('replay-intro')">👋 Lihat pengenalan lagi</button>
    </div>
  </div>
</template>