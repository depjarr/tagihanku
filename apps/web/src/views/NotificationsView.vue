<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../api/auth'
import NotificationSettings from '../components/NotificationSettings.vue'
import { useAuthStore } from '../stores/authStore'

const router = useRouter()
const auth = useAuthStore()
const items = ref([])
const loading = ref(true)
const error = ref('')

const ICON = { PAID: '💸', BILL_DONE: '🎉', REMINDER: '⏰', BILL_CREATED: '🧾', LINK_OPENED: '👀' }

function timeAgo(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'baru saja'
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

onMounted(async () => {
  try {
    const res = await authApi.notifications()
    items.value = res.items
    auth.unread = res.unread
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function open(n) {
  if (!n.readAt) {
    n.readAt = new Date().toISOString()
    auth.unread = Math.max(0, auth.unread - 1)
    authApi.markRead(n.id).catch(() => {})
  }
  if (n.billId) router.push({ name: 'summary', params: { id: n.billId } })
}
async function readAll() {
  try {
    await authApi.markAllRead()
    items.value.forEach((n) => (n.readAt ||= new Date().toISOString()))
    auth.unread = 0
  } catch (e) { error.value = e.message }
}
async function clearAll() {
  if (!confirm('Hapus semua notifikasi?')) return
  try { await authApi.clearNotifications(); items.value = []; auth.unread = 0 } catch (e) { error.value = e.message }
}
</script>

<template>
  <main class="screen">
    <div class="flex items-center justify-between">
      <button class="btn-pill" @click="router.push({ name: 'home' })">Kembali</button>
      <button class="btn-pill" :disabled="!auth.unread" @click="readAll">Tandai dibaca</button>
    </div>
    <h1 class="h1">Notifikasi</h1>

    <p v-if="loading" class="mt-6 text-muted">Memuat…</p>
    <p v-if="error" class="notice mt-4">{{ error }}</p>
    <p v-if="!loading && !items.length && !error" class="card mt-6 text-center text-muted">Belum ada notifikasi.</p>

    <div v-if="items.length" class="mt-4 flex gap-2">
      <button class="btn-pill" @click="clearAll">Hapus semua</button>
    </div>

    <button
      v-for="n in items" :key="n.id"
      class="card mt-2 flex w-full items-start gap-3 text-left" :class="!n.readAt ? 'border-brand-ink' : ''"
      @click="open(n)"
    >
      <span class="text-xl">{{ ICON[n.type] || '🔔' }}</span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center justify-between gap-2">
          <b>{{ n.title }}</b>
          <span v-if="!n.readAt" class="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-ink" aria-label="Belum dibaca" />
        </span>
        <span class="mt-0.5 block text-sm text-muted">{{ n.body }}</span>
        <span class="mt-1 block text-xs text-muted">{{ timeAgo(n.createdAt) }}</span>
      </span>
    </button>

    <p class="eyebrow mt-8">Pengaturan notifikasi</p>
    <div class="mt-2"><NotificationSettings /></div>
  </main>
</template>
