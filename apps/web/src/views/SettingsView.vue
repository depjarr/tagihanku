<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { notifSummary } from '../composables/useSummaries'

const auth = useAuthStore()
const router = useRouter()
const go = (name) => router.push({ name })
const initial = computed(() => (auth.user?.name || '?').trim().charAt(0).toUpperCase())

function logout() {
  auth.logout()
  router.replace({ name: 'home' })
}
</script>

<template>
  <main class="screen">
    <button class="btn-pill" @click="go('home')">Kembali</button>
    <h1 class="h1">Pengaturan</h1>

    <button class="card mt-4 flex w-full items-center gap-4 text-left !p-3.5" @click="go('settings-profile')">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-on-brand">{{ initial }}</span>
      <span class="min-w-0">
        <b class="block truncate text-base">{{ auth.user?.name || '…' }}</b>
        <span class="block truncate text-sm text-muted">{{ auth.user?.email }}</span>
      </span>
    </button>

    <p class="eyebrow mt-6">Aplikasi</p>
    <section class="card mt-2 !py-0">
      <button class="menu-row" @click="go('settings-notifications')">
        <span class="menu-icon" aria-hidden="true">🔔</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate">Notifikasi</span>
          <span class="block truncate text-sm font-medium text-muted">{{ notifSummary(auth.settings) }}</span>
        </span>
        <span aria-hidden="true" class="text-muted">›</span>
      </button>
    </section>

    <p class="eyebrow mt-6">Akun</p>
    <section class="card mt-2 !py-0">
      <button class="menu-row" @click="go('settings-password')">
        <span class="menu-icon" aria-hidden="true">🔑</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate">Ubah password</span>
        </span>
        <span aria-hidden="true" class="text-muted">›</span>
      </button>
      <button class="menu-row" @click="go('settings-claim')">
        <span class="menu-icon" aria-hidden="true">📦</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate">Pindahkan tagihan dari perangkat ini</span>
        </span>
        <span aria-hidden="true" class="text-muted">›</span>
      </button>
      <button class="menu-row text-danger" @click="logout">
        <span class="menu-icon" aria-hidden="true">🚪</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate">Keluar</span>
        </span>
      </button>
    </section>

    <p class="mt-8 text-center text-sm text-muted">Tagihanku versi 1.0</p>
  </main>
</template>