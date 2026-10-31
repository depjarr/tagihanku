<script setup>
// Kamera langsung di dalam aplikasi: foto struk -> keluar sebagai File (JPEG).
// - butuh HTTPS atau localhost (aturan browser); di alamat http biasa tombol "Kamera bawaan HP" tetap bisa dipakai
// - kamera belakang jadi default, ada tombol ganti kamera & senter (kalau perangkat mendukung)
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { toast } from '../composables/useToast'

const emit = defineEmits(['capture', 'close'])

const video = ref(null)
const nativeInput = ref(null)
const galleryInput = ref(null)
const ready = ref(false)
const error = ref('')
const facing = ref('environment')
const torchOn = ref(false)
const hasTorch = ref(false)
const flashing = ref(false)
let stream = null

function explain(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, lalu coba lagi.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera tidak ditemukan di perangkat ini.'
    case 'NotReadableError':
      return 'Kamera sedang dipakai aplikasi lain. Tutup dulu aplikasi itu.'
    default:
      return 'Kamera tidak bisa dibuka.'
  }
}

function stop() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  ready.value = false
}

async function start() {
  stop()
  error.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = window.isSecureContext
      ? 'Browser ini belum mendukung kamera langsung.'
      : 'Kamera langsung hanya jalan di HTTPS atau localhost. Pakai tombol "Kamera bawaan HP" di bawah.'
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing.value }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    video.value.srcObject = stream
    await video.value.play()
    const track = stream.getVideoTracks()[0]
    hasTorch.value = !!track.getCapabilities?.().torch
    torchOn.value = false
    ready.value = true
  } catch (e) {
    error.value = explain(e)
  }
}

async function toggleTorch() {
  const track = stream?.getVideoTracks()[0]
  if (!track) return
  try {
    await track.applyConstraints({ advanced: [{ torch: !torchOn.value }] })
    torchOn.value = !torchOn.value
  } catch {
    toast.info('Senter tidak tersedia di kamera ini.')
  }
}

function flip() {
  facing.value = facing.value === 'environment' ? 'user' : 'environment'
  start()
}

function shoot() {
  const v = video.value
  if (!ready.value || !v?.videoWidth) return
  const c = document.createElement('canvas')
  c.width = v.videoWidth
  c.height = v.videoHeight
  c.getContext('2d').drawImage(v, 0, 0)
  flashing.value = true
  setTimeout(() => (flashing.value = false), 260)
  c.toBlob(
    (blob) => {
      if (!blob) return toast.error('Gagal mengambil foto, coba lagi.')
      emit('capture', new File([blob], `struk-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    },
    'image/jpeg',
    0.92,
  )
}

function pickFile(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (f) emit('capture', f)
}

const onVisibility = () => { if (document.hidden) stop(); else if (!error.value) start() }

onMounted(() => { start(); document.addEventListener('visibilitychange', onVisibility) })
onBeforeUnmount(() => { stop(); document.removeEventListener('visibilitychange', onVisibility) })
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black flex flex-col mx-auto max-w-md">
    <!-- hidden inputs -->
    <input ref="nativeInput" type="file" accept="image/*" capture="environment" class="hidden" @change="pickFile" />
    <input ref="galleryInput" type="file" accept="image/*" class="hidden" @change="pickFile" />

    <!-- atas -->
    <div class="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <button class="w-10 h-10 rounded-full bg-black/45 text-white font-bold backdrop-blur" aria-label="Tutup kamera" @click="emit('close')">✕</button>
      <span class="text-[11px] font-extrabold text-white/90 bg-black/45 backdrop-blur px-3 py-1.5 rounded-full">Foto struk</span>
      <button
        class="w-10 h-10 rounded-full backdrop-blur font-bold transition"
        :class="torchOn ? 'bg-sun text-black' : 'bg-black/45 text-white'"
        :disabled="!hasTorch" :style="{ opacity: hasTorch ? 1 : .35 }"
        aria-label="Senter" @click="toggleTorch"
      >⚡</button>
    </div>

    <!-- pratinjau -->
    <div class="relative flex-1 overflow-hidden">
      <video ref="video" playsinline muted autoplay class="absolute inset-0 w-full h-full object-cover" />

      <!-- bingkai panduan -->
      <div v-if="ready" class="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <div class="relative w-full h-[68%] rounded-3xl border-2 border-white/25">
          <span class="absolute -top-0.5 -left-0.5 w-9 h-9 border-t-4 border-l-4 border-white rounded-tl-3xl" />
          <span class="absolute -top-0.5 -right-0.5 w-9 h-9 border-t-4 border-r-4 border-white rounded-tr-3xl" />
          <span class="absolute -bottom-0.5 -left-0.5 w-9 h-9 border-b-4 border-l-4 border-white rounded-bl-3xl" />
          <span class="absolute -bottom-0.5 -right-0.5 w-9 h-9 border-b-4 border-r-4 border-white rounded-br-3xl" />
        </div>
      </div>
      <div v-if="ready" class="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none">
        <div class="bg-sun text-[#2b2118] px-3.5 py-2 rounded-2xl text-[11px] font-extrabold shadow-lg max-w-full text-center leading-tight">
          💡 Taruh struk di dalam kotak, pastikan terang & tulisannya kebaca
        </div>
      </div>

      <!-- error / loading -->
      <div v-if="!ready" class="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-3 text-white">
        <template v-if="error">
          <span class="text-5xl">📷</span>
          <p class="text-sm font-bold leading-relaxed">{{ error }}</p>
          <button class="btn-sun px-4 py-2.5 text-xs" @click="start">Coba lagi</button>
        </template>
        <template v-else>
          <span class="text-5xl animate-pulse">📷</span>
          <p class="text-xs font-bold text-white/80">Membuka kamera…</p>
        </template>
      </div>

      <div v-if="flashing" class="absolute inset-0 bg-white animate-shutter pointer-events-none" />
    </div>

    <!-- bawah -->
    <div class="bg-black px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3">
      <div class="flex items-center justify-between">
        <button class="w-12 h-12 rounded-full bg-white/15 text-white text-xl active:scale-95 transition" aria-label="Pilih dari galeri" @click="galleryInput.click()">🖼️</button>
        <button
          class="w-20 h-20 rounded-full border-4 border-white p-1.5 active:scale-90 transition disabled:opacity-40"
          :disabled="!ready" aria-label="Ambil foto" @click="shoot"
        >
          <span class="block w-full h-full rounded-full bg-white" />
        </button>
        <button class="w-12 h-12 rounded-full bg-white/15 text-white text-xl active:scale-95 transition" aria-label="Ganti kamera" @click="flip">🔄</button>
      </div>
      <button class="w-full text-center text-[11px] font-bold text-white/70 underline underline-offset-2" @click="nativeInput.click()">
        Kamera tidak mau terbuka? Pakai kamera bawaan HP
      </button>
    </div>
  </div>
</template>