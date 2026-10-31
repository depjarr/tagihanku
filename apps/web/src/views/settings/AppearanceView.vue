<script setup>
// Pengaturan > Tampilan. Memilih warna / mode langsung dipratinjau di SELURUH aplikasi
// (semua langkah ikut berubah); baru tersimpan setelah menekan "Simpan tampilan".
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ACCENTS, accentOf, applyAppearance, describeLook, MODES } from '../../composables/useAccent'
import { useAuthStore } from '../../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const draft = reactive({ accent: auth.settings.accent, theme: auth.settings.theme })
const msg = ref('')
const error = ref('')

watch(draft, () => applyAppearance(draft), { deep: true }) // pratinjau langsung
onBeforeUnmount(() => auth.applyLook()) // belum disimpan → kembali ke tampilan tersimpan

const a = computed(() => accentOf(draft.accent))
const dirty = computed(() => draft.accent !== auth.settings.accent || draft.theme !== auth.settings.theme)

async function save() {
  error.value = ''
  try {
    await auth.saveSettings({ accent: draft.accent, theme: draft.theme })
    msg.value = 'Tampilan disimpan'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) { error.value = e.message }
}
const back = () => (window.history.length > 1 ? router.back() : router.push({ name: 'home' }))
</script>

<template>
  <main class="screen">
    <div class="flex items-center justify-between gap-3">
      <button class="btn-pill" @click="back">Kembali</button>
      <b class="text-sm text-brand-ink">{{ describeLook(draft.accent, draft.theme) }}</b>
    </div>
    <h1 class="h1">Tampilan</h1>

    <p class="label mt-5">Warna utama (pastel)</p>
    <div class="grid grid-cols-2 gap-2.5">
      <button
        v-for="c in ACCENTS" :key="c.value" type="button"
        class="flex h-14 items-center gap-2.5 rounded-2xl border bg-surface px-3 text-sm font-bold"
        :style="draft.accent === c.value ? { border: `2px solid ${c.ink}`, background: c.soft, color: '#1F2937' } : {}"
        :class="draft.accent === c.value ? '' : 'border-line'"
        :aria-pressed="draft.accent === c.value"
        @click="draft.accent = c.value"
      >
        <span class="h-[26px] w-[26px] rounded-full border border-black/10" :style="{ background: c.swatch }" />
        {{ c.label }}
        <svg v-if="draft.accent === c.value" class="ml-auto" width="18" height="18" viewBox="0 0 24 24" fill="none" :stroke="c.ink" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="Dipilih"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </button>
    </div>

    <p class="label mt-6">Mode</p>
    <div class="flex gap-2">
      <button
        v-for="m in MODES" :key="m.value" type="button"
        class="h-11 flex-1 rounded-full border text-sm font-bold"
        :class="draft.theme === m.value ? 'border-2 border-brand-ink bg-brand text-on-brand' : 'border-line bg-surface'"
        :aria-pressed="draft.theme === m.value"
        @click="draft.theme = m.value"
      >{{ m.label }}</button>
    </div>

    <p class="label mt-6">Pratinjau</p>
    <div class="flex gap-2.5">
      <div class="flex flex-1 flex-col gap-1.5 rounded-2xl border p-3" style="background:#fff;border-color:#D5DBE3">
        <b class="text-[13px]" style="color:#111827">Makan siang tim</b>
        <b class="text-xl" :style="{ color: a.ink }">Rp 126.500</b>
        <span class="flex h-11 items-center justify-center rounded-xl text-sm font-extrabold" :style="{ background: a.swatch, color: a.ink }">Bagikan</span>
        <span class="text-xs font-bold" style="color:#4B5563">Terang (putih)</span>
      </div>
      <div class="flex flex-1 flex-col gap-1.5 rounded-2xl border p-3" style="background:#161B22;border-color:#2B3340">
        <b class="text-[13px]" style="color:#E6EDF3">Makan siang tim</b>
        <b class="text-xl" :style="{ color: a.swatch }">Rp 126.500</b>
        <span class="flex h-11 items-center justify-center rounded-xl text-sm font-extrabold" :style="{ background: a.swatch, color: a.ink }">Bagikan</span>
        <span class="text-xs font-bold" style="color:#B6C0CC">Gelap</span>
      </div>
    </div>
    <p class="mt-3 text-xs leading-relaxed text-muted">
      Status Lunas / Belum bayar tetap hijau dan kuning, dan QRIS yang diunduh tetap hitam di atas putih.
    </p>

    <p v-if="msg" class="notice-ok mt-4">{{ msg }}</p>
    <p v-if="error" class="notice mt-4">{{ error }}</p>
    <div class="bar"><button class="btn-primary" :disabled="!dirty" @click="save">Simpan tampilan</button></div>
  </main>
</template>
