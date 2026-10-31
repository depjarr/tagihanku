<script setup>
// Daftar metode pembayaran (dipakai di Buat tagihan dan Pengaturan > Metode pembayaran).
// Isi satu item: { type: 'QRIS'|'BANK'|'EWALLET', label, accountNumber?, accountName?, qrisPayload? }
import { computed, reactive, ref } from 'vue'
import { decodeQrFromFile } from '../composables/useQrScan'
import { isValidQris, merchantName } from '../composables/useQris'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])

const file = ref(null)
const error = ref('')
const reading = ref(false)
const adding = ref(false)
const draft = reactive({ type: 'BANK', label: '', accountNumber: '', accountName: '' })

const qris = computed(() => props.modelValue.find((m) => m.type === 'QRIS'))
const others = computed(() => props.modelValue.filter((m) => m.type !== 'QRIS'))

async function onPhoto(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  error.value = ''
  reading.value = true
  try {
    const text = await decodeQrFromFile(f)
    if (!text) throw new Error('QR tidak terbaca. Coba foto yang lebih dekat, terang, dan tidak miring.')
    if (!isValidQris(text)) throw new Error('QR terbaca, tapi bukan QRIS yang valid (kode CRC tidak cocok).')
    const label = merchantName(text) || 'QRIS'
    emit('update:modelValue', [{ type: 'QRIS', label, qrisPayload: text }, ...others.value])
  } catch (err) {
    error.value = err.message
  } finally {
    reading.value = false
  }
}

function addOther() {
  if (!draft.label.trim()) return (error.value = 'Isi nama bank / e-wallet')
  error.value = ''
  emit('update:modelValue', [
    ...props.modelValue,
    { type: draft.type, label: draft.label.trim(), accountNumber: draft.accountNumber.trim(), accountName: draft.accountName.trim() },
  ])
  Object.assign(draft, { type: 'BANK', label: '', accountNumber: '', accountName: '' })
  adding.value = false
}
const remove = (m) => emit('update:modelValue', props.modelValue.filter((x) => x !== m))
</script>

<template>
  <div>
    <input ref="file" type="file" accept="image/*" class="hidden" @change="onPhoto" />

    <div v-if="qris" class="flex items-center justify-between gap-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm">
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-wide text-brand-ink">QRIS terbaca</p>
        <b class="block truncate">{{ qris.label }}</b>
      </div>
      <div class="flex shrink-0 gap-2">
        <button type="button" class="btn-pill !px-3 !py-1.5" :disabled="reading" @click="file.click()">Ganti</button>
        <button type="button" class="btn-pill !px-3 !py-1.5" aria-label="Hapus QRIS" @click="remove(qris)">✕</button>
      </div>
    </div>

    <ul v-if="others.length" class="mt-2 space-y-2">
      <li v-for="(m, i) in others" :key="i" class="flex items-center justify-between gap-3 rounded-2xl bg-brand-soft px-4 py-2 text-sm">
        <span class="min-w-0 truncate"><b>{{ m.label }}</b> <span class="text-muted">{{ m.accountNumber }}<template v-if="m.accountName"> · a.n. {{ m.accountName }}</template></span></span>
        <button type="button" aria-label="Hapus" @click="remove(m)">✕</button>
      </li>
    </ul>

    <div class="mt-3 grid gap-2" :class="qris ? '' : 'grid-cols-2'">
      <button v-if="!qris" type="button" class="btn-dashed" :disabled="reading" @click="file.click()">
        {{ reading ? 'Membaca…' : '+ Foto QRIS' }}
      </button>
      <button type="button" class="btn-dashed" @click="adding = !adding">+ Rekening / e-wallet</button>
    </div>

    <div v-if="adding" class="mt-3 space-y-2 rounded-2xl border border-line p-3">
      <select v-model="draft.type" class="input">
        <option value="BANK">Transfer bank</option>
        <option value="EWALLET">E-wallet</option>
      </select>
      <input v-model="draft.label" class="input" placeholder="BCA, DANA, GoPay…" />
      <div class="grid grid-cols-2 gap-2">
        <input v-model="draft.accountNumber" class="input" placeholder="No. rekening / HP" inputmode="numeric" />
        <input v-model="draft.accountName" class="input" placeholder="Atas nama" />
      </div>
      <button type="button" class="btn-pill w-full" @click="addOther">Simpan metode</button>
    </div>

    <p v-if="error" class="notice mt-3">{{ error }}</p>
    <p class="mt-3 text-sm text-muted">QRIS merchant bisa kena biaya MDR. QRIS personal / e-wallet lebih cocok untuk patungan.</p>
  </div>
</template>
