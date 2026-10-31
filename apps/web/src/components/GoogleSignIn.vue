<script setup>
// Tombol "Lanjutkan dengan Google". Hanya muncul kalau server punya GOOGLE_CLIENT_ID.
// Memakai Google Identity Services; token ID-nya diverifikasi server di POST /auth/google.
import { onMounted, ref } from 'vue'
import { authApi } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

const emit = defineEmits(['done', 'error'])
const auth = useAuthStore()
const host = ref(null)
const enabled = ref(false)

let gsiLoading = null
const loadGsi = () =>
  (gsiLoading ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Gagal memuat Google'))
    document.head.appendChild(s)
  }))

onMounted(async () => {
  try {
    const { googleClientId } = await authApi.config()
    if (!googleClientId) return
    await loadGsi()
    enabled.value = true
    await new Promise((r) => setTimeout(r)) // tunggu elemen host tampil
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async ({ credential }) => {
        try { await auth.loginWithGoogle(credential); emit('done') } catch (e) { emit('error', e.message) }
      },
    })
    window.google.accounts.id.renderButton(host.value, {
      type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill',
      width: Math.min(host.value?.offsetWidth || 350, 400),
    })
  } catch { /* tanpa Google: form email tetap jalan */ }
})
</script>

<template>
  <div v-show="enabled">
    <div ref="host" class="flex min-h-[44px] justify-center" />
    <div class="my-5 flex items-center gap-3 text-sm text-muted">
      <span class="h-px flex-1 bg-line" />atau<span class="h-px flex-1 bg-line" />
    </div>
  </div>
</template>
