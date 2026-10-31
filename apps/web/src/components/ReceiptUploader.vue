<script setup>
import { computed, ref } from 'vue'
import { useBillStore } from '../stores/billStore'
import { formatTaxService, number, parseTaxService, rupiah, toInt } from '../composables/useFormat'
import { prepareReceiptImage } from '../composables/useReceiptImage'

const emit = defineEmits(['confirm', 'manual'])
const store = useBillStore()

const camera = ref(null)
const gallery = ref(null)
const busy = ref(false)
const error = ref('')
const parsed = ref(null)
const lines = ref([]) // { name, priceText, qty, suspicious, suggestedPrice }
const taxText = ref('') // "pajak + service", mis. "10% + 5%" (terisi dari struk, bisa diedit)
const dateText = ref('') // YYYY-MM-DD

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    const ready = await prepareReceiptImage(file)
    parsed.value = await store.uploadReceipt(ready)
    lines.value = parsed.value.lines.map((l) => ({ ...l, priceText: number(l.price) }))
    // pajak/service: pakai yang terbaca dari struk; kalau tidak terbaca, pertahankan isian langkah 1
    const b = store.bill
    const p = parsed.value
    const known = p.taxPercent !== undefined || p.servicePercent !== undefined
    taxText.value = known
      ? formatTaxService(p.taxPercent ?? 0, p.servicePercent ?? 0)
      : formatTaxService(b?.taxPercent ?? 0, b?.servicePercent ?? 0)
    dateText.value = p.date || b?.billDate || ''
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

const itemsSum = computed(() => lines.value.reduce((a, l) => a + toInt(l.priceText), 0))
const mismatch = computed(() => (parsed.value?.subtotal ? parsed.value.subtotal - itemsSum.value : null))
const flagged = computed(() => lines.value.filter((l) => l.suspicious && toInt(l.priceText) === l.price))
const fee = computed(() => (parsed.value ? (parsed.value.tax ?? 0) + (parsed.value.service ?? 0) : 0))

const useSuggested = (l) => { l.priceText = number(l.suggestedPrice); l.suspicious = false }
const addLine = () => lines.value.push({ name: '', priceText: '', qty: 1, suspicious: false })

function confirm() {
  const valid = lines.value
    .map((l) => ({ name: l.name.trim(), price: toInt(l.priceText), qty: l.qty || 1 }))
    .filter((l) => l.name && l.price > 0)
  if (!valid.length) return
  // pajak, service, dan tanggal ikut disamakan dengan struk
  const { tax, service } = parseTaxService(taxText.value)
  const patch = { taxPercent: tax, servicePercent: service }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText.value)) patch.billDate = dateText.value
  emit('confirm', valid, patch)
}
</script>

<template>
  <div>
    <!-- Tahap ambil foto -->
    <template v-if="!parsed">
      <p class="eyebrow">Tahap 2 · OCR</p>
      <h2 class="h1">Scan struk</h2>
      <div class="mt-4 flex aspect-[3/4] items-center justify-center rounded-3xl bg-[#14201C] p-8 text-center text-sm font-semibold text-white/80">
        {{ busy ? 'Membaca struk…' : 'Posisikan seluruh struk di dalam bingkai' }}
      </div>
      <div class="card mt-3 text-sm text-muted">
        <b class="text-ink">Tips:</b> taruh struk di permukaan rata, cahaya cukup, hindari bayangan, dan ratakan lipatan.
      </div>
      <p v-if="error" class="notice mt-3">{{ error }}</p>

      <input ref="camera" type="file" accept="image/*" capture="environment" class="hidden" @change="onFile" />
      <input ref="gallery" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" @change="onFile" />
      <div class="mt-6 space-y-3">
        <button class="btn-primary" :disabled="busy" @click="camera.click()">Ambil foto</button>
        <button class="btn-outline" :disabled="busy" @click="gallery.click()">Pilih dari galeri</button>
        <button class="w-full py-2 font-bold text-muted" @click="emit('manual')">Isi manual saja</button>
      </div>
    </template>

    <!-- Tahap periksa hasil -->
    <template v-else>
      <p class="eyebrow">Tahap 2 · OCR</p>
      <h2 class="h1">Periksa hasil scan</h2>
      <div class="card mt-4 text-sm text-muted">
        {{ parsed.merchant || 'Struk' }}<br />
        <b class="text-ink">{{ lines.length }} baris terbaca<template v-if="flagged.length">, {{ flagged.length }} perlu dicek</template></b>
      </div>

      <p class="eyebrow mt-5">Item</p>
      <div class="mt-2 space-y-2">
        <template v-for="(l, i) in lines" :key="i">
          <div class="flex gap-2">
            <input v-model="l.name" class="input" placeholder="Nama item" />
            <input
              v-model="l.priceText"
              inputmode="numeric"
              class="input w-32 text-right"
              :class="{ '!border-warn !bg-warn-soft/50': l.suspicious && toInt(l.priceText) === l.price }"
            />
          </div>
          <button
            v-if="l.suspicious && toInt(l.priceText) === l.price"
            type="button"
            class="notice w-full text-left"
            @click="useSuggested(l)"
          >
            Harga terbaca {{ number(l.price) }}. Mungkin maksudnya {{ number(l.suggestedPrice) }}? <u>Pakai</u>
          </button>
        </template>
        <button class="btn-dashed" @click="addLine">+ Tambah baris</button>
      </div>

      <div class="card mt-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Pajak + service</label>
            <input v-model="taxText" class="input" inputmode="decimal" placeholder="10% + 5%" />
          </div>
          <div>
            <label class="label">Tanggal struk</label>
            <input v-model="dateText" type="date" class="input" />
          </div>
        </div>
        <p class="text-xs text-muted">Diisi dari struk. Periksa, lalu ubah kalau tidak sesuai.</p>
      </div>

      <div class="card mt-3 space-y-1 text-sm">
        <div class="flex justify-between"><span>Jumlah item</span><b>{{ rupiah(itemsSum) }}</b></div>
        <div v-if="parsed.subtotal" class="flex justify-between"><span>Subtotal di struk</span><b>{{ rupiah(parsed.subtotal) }}</b></div>
        <div v-if="fee" class="flex justify-between"><span>Pajak + service di struk</span><b>{{ rupiah(fee) }}</b></div>
        <div v-if="parsed.total" class="flex justify-between"><span>Total di struk</span><b>{{ rupiah(parsed.total) }}</b></div>
      </div>
      <p v-if="mismatch" class="notice mt-3">
        Selisih {{ rupiah(Math.abs(mismatch)) }}: jumlah item belum cocok dengan subtotal
      </p>
      <p v-else-if="mismatch === 0" class="notice-ok mt-3">Jumlah item cocok dengan subtotal struk</p>
      <p v-if="!lines.length" class="notice mt-3">
        Tidak ada item yang terbaca. Coba foto ulang (lurus, terang, tanpa bayangan) atau tambah baris manual.
      </p>
      <details v-if="parsed.rawText" class="mt-3 text-sm text-muted">
        <summary class="cursor-pointer font-semibold">Lihat teks hasil baca</summary>
        <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-brand-soft p-3 text-xs">{{ parsed.rawText }}</pre>
      </details>

      <div class="bar"><button class="btn-primary" :disabled="!lines.length" @click="confirm">Lanjut ke pembagian</button></div>
    </template>
  </div>
</template>
