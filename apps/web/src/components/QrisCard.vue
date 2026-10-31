<script setup>
// QRIS ber-nominal untuk halaman teman: QRIS statis milik pembuat + nominal bagian si teman.
import { computed, onMounted, ref, watch } from 'vue'
import { drawQr, qrToDataUrl } from '../composables/useQrScan'
import { isValidQris, merchantName, toDynamicQris } from '../composables/useQris'
import { rupiah } from '../composables/useFormat'

const props = defineProps({ payload: { type: String, required: true }, amount: { type: Number, required: true }, label: String })
const canvas = ref(null)
const error = ref('')
const busy = ref(false)

const dynamic = computed(() => {
  try { return isValidQris(props.payload) && props.amount >= 1 ? toDynamicQris(props.payload, props.amount) : '' } catch { return '' }
})
const merchant = computed(() => merchantName(props.payload) || props.label || 'QRIS')

async function render() {
  error.value = ''
  if (!dynamic.value || !canvas.value) return
  try { await drawQr(canvas.value, dynamic.value) } catch { error.value = 'QR tidak bisa ditampilkan' }
}
onMounted(render)
watch(dynamic, render, { flush: 'post' }) // tunggu <canvas> tampil dulu

async function download() {
  busy.value = true
  try {
    const a = document.createElement('a')
    a.href = await qrToDataUrl(dynamic.value)
    a.download = `qris-${merchant.value.replace(/[^\w-]+/g, '_')}-${Math.round(props.amount)}.png`
    a.click()
  } catch { error.value = 'Gagal membuat gambar QRIS' } finally { busy.value = false }
}
</script>

<template>
  <div class="card">
    <div class="flex items-center justify-between gap-2">
      <b>QRIS</b>
      <span v-if="dynamic" class="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-ink">Nominal terisi</span>
    </div>
    <template v-if="dynamic">
      <!-- QR selalu hitam di atas putih, apa pun tema, supaya terbaca aplikasi bank -->
      <div class="mx-auto mt-3 w-full max-w-[18rem] aspect-square overflow-hidden rounded-2xl bg-white p-2"><canvas ref="canvas" class="!block !w-full !h-full" /></div>
      <dl class="mt-3 space-y-1 text-sm">
        <div class="flex justify-between gap-3"><dt class="text-muted">Penerima</dt><dd class="text-right font-bold">{{ merchant }}</dd></div>
        <div class="flex justify-between gap-3"><dt class="text-muted">Nominal</dt><dd class="font-bold">{{ rupiah(amount) }}</dd></div>
      </dl>
      <button class="btn-outline mt-3" :disabled="busy" @click="download">Unduh QRIS ber-nominal</button>
      <p class="mt-2 text-sm text-muted">Buka aplikasi bank atau e-wallet, pilih scan dari galeri.</p>
    </template>
    <p v-else class="mt-2 text-sm text-muted">QRIS tidak bisa dibuat untuk nominal ini. Hubungi pembuat tagihan.</p>
    <p v-if="error" class="notice mt-3">{{ error }}</p>
  </div>
</template>