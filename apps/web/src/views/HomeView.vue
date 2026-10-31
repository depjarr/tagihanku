<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { authApi } from '../api/auth'
import { billsApi } from '../api/bills'
import { useAuthStore } from '../stores/authStore'
import { myBills } from '../composables/useMyBills'
import { formatDate, rupiah } from '../composables/useFormat'

const router = useRouter()
const auth = useAuthStore()
const bills = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const ids = myBills.ids()
  try {
    bills.value = auth.loggedIn ? await authApi.myBills() : ids.length ? await billsApi.list(ids) : []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const active = computed(() => bills.value.filter((b) => b.status === 'ACTIVE'))
const done = computed(() => bills.value.filter((b) => b.status === 'DONE'))
const open = (b) => router.push({ name: 'summary', params: { id: b.id } })
</script>

<template>
  <main class="screen">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-4xl font-extrabold">Tagihan</h1>
      <div v-if="auth.loggedIn" class="flex items-center gap-2">
        <button class="btn-pill relative !px-3" aria-label="Notifikasi" @click="router.push({ name: 'notifications' })">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          <span v-if="auth.unread" class="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-[18px] text-white">{{ auth.unread > 9 ? '9+' : auth.unread }}</span>
        </button>
        <button class="btn-pill !px-3" aria-label="Pengaturan" @click="router.push({ name: 'settings' })">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
      <div v-else class="flex items-center gap-2">
        <button class="btn-pill !px-3" aria-label="Tampilan" @click="router.push({ name: 'settings-appearance' })">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9z"/></svg>
        </button>
        <button class="btn-pill" @click="router.push({ name: 'login' })">Masuk</button>
      </div>
    </div>

    <p v-if="!auth.loggedIn" class="card mt-4 text-sm text-muted">
      Masuk agar tagihanmu tersimpan di semua perangkat dan kamu dapat pengingat otomatis.
      <RouterLink :to="{ name: 'register' }" class="font-bold text-brand-ink">Daftar gratis</RouterLink>
    </p>
    <p v-if="loading" class="mt-6 text-muted">Memuat…</p>
    <p v-if="error" class="notice mt-4">{{ error }}</p>

    <p v-if="!loading && !bills.length && !error" class="card mt-6 text-center text-muted">
      Belum ada tagihan. Mulai dengan split bill pertamamu.
    </p>

    <template v-if="active.length">
      <p class="eyebrow mt-6">Aktif ({{ active.length }})</p>
      <button v-for="b in active" :key="b.id" class="card mt-2 block w-full border-warn text-left" @click="open(b)">
        <div class="flex items-center justify-between gap-2">
          <b class="text-lg">{{ b.title }}</b>
          <span class="rounded-full bg-warn-soft px-3 py-1 text-xs font-bold text-warn-ink">
            {{ b.summary.paidCount }} dari {{ b.participants.length }} bayar
          </span>
        </div>
        <div class="mt-1 flex items-end justify-between text-sm text-muted">
          <span>{{ formatDate(b.billDate) }} · sisa {{ rupiah(b.summary.remaining) }}</span>
          <b class="text-lg text-ink">{{ rupiah(b.summary.grandTotal) }}</b>
        </div>
      </button>
    </template>

    <template v-if="done.length">
      <p class="eyebrow mt-6">Selesai ({{ done.length }})</p>
      <button v-for="b in done" :key="b.id" class="card mt-2 block w-full text-left" @click="open(b)">
        <div class="flex items-center justify-between gap-2">
          <b class="text-lg">{{ b.title }}</b>
          <span class="rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok-ink">Lunas</span>
        </div>
        <div class="mt-1 flex items-end justify-between text-sm text-muted">
          <span>{{ formatDate(b.billDate) }} · {{ b.participants.length }} orang</span>
          <b class="text-lg text-ink">{{ rupiah(b.summary.grandTotal) }}</b>
        </div>
      </button>
    </template>

    <div class="bar"><button class="btn-primary" @click="router.push({ name: 'new' })">+ Split bill baru</button></div>
  </main>
</template>
