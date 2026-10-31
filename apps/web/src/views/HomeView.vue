<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import CatMascot from '../components/CatMascot.vue'
import ThemeSheet from '../components/ThemeSheet.vue'
import { authApi } from '../api/auth'
import { billsApi } from '../api/bills'
import { useAuthStore } from '../stores/authStore'
import { myBills } from '../composables/useMyBills'
import { formatDate, rupiah } from '../composables/useFormat'

const router = useRouter()
const auth = useAuthStore()
const bills = ref([])
const loading = ref(true)
const showTheme = ref(false)
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
const greetName = computed(() => {
  if (!auth.loggedIn) return 'kamu'
  const first = (auth.user?.name || '').trim().split(/\s+/)[0]
  return first || ''
})
const open = (b) => router.push({ name: 'summary', params: { id: b.id } })
</script>

<template>
  <main class="screen !pb-28">
    <header class="flex items-center justify-between gap-3 pt-1">
      <div class="flex items-center gap-2.5">
        <CatMascot :size="46" mood="happy" />
        <div>
          <h1 class="font-bold text-2xl leading-none text-ink">Tagihanku</h1>
          <p class="mt-0.5 text-[11px] font-bold text-muted">{{ auth.loggedIn ? 'Split bill santai' : 'Split bill santai, tanpa login' }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="circle-btn" aria-label="Tampilan" @click="showTheme = true">🎨</button>
        <template v-if="auth.loggedIn">
          <button class="circle-btn relative" aria-label="Notifikasi" @click="router.push({ name: 'notifications' })">
            🔔
            <span v-if="auth.unread" class="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-[18px] text-white">{{ auth.unread > 9 ? '9+' : auth.unread }}</span>
          </button>
          <button class="circle-btn" aria-label="Pengaturan" @click="router.push({ name: 'settings' })">⚙️</button>
        </template>
        <button v-else class="btn-pill" @click="router.push({ name: 'login' })">Masuk</button>
      </div>
    </header>

    <section class="card relative mt-4 overflow-hidden !bg-hero p-5 text-hero-ink">
      <p class="text-[11px] font-extrabold uppercase tracking-widest opacity-80">{{ greetName ? `Halo, ${greetName}!` : 'Halo!' }}</p>
      <h2 class="mt-1 text-3xl font-extrabold leading-tight">{{ active.length ? 'Masih ada yang nunggu' : 'Yuk mulai!' }}</h2>
      <p class="mt-1 max-w-[60%] text-sm font-semibold opacity-90">
        {{ active.length ? `${active.length} tagihan belum lunas semua.` : 'Bikin split bill pertamamu, gampang kok.' }}
      </p>
      <div class="absolute -bottom-2 right-3"><CatMascot :size="104" mood="hi" bare /></div>
    </section>

    <p v-if="!auth.loggedIn" class="card-flat mt-4 p-3 text-xs font-bold text-muted">
      Masuk agar tagihanmu tersimpan di semua perangkat dan kamu dapat pengingat otomatis.
      <RouterLink :to="{ name: 'register' }" class="font-extrabold text-brand-ink">Daftar gratis</RouterLink>
    </p>
    <p v-if="error" class="notice mt-4">{{ error }}</p>

    <p class="eyebrow mt-6">Riwayat tagihan ({{ bills.length }})</p>
    <p v-if="loading" class="mt-3 text-sm font-bold text-muted">Memuat…</p>

    <div v-else-if="!bills.length && !error" class="card gingham mt-3 px-6 py-10 text-center">
      <div class="text-4xl">🧾</div>
      <p class="mt-3 font-extrabold text-ink">Belum ada tagihan tersimpan</p>
      <p class="mt-1 text-sm font-bold text-muted">Tekan tombol di bawah untuk bikin yang pertama.</p>
    </div>

    <template v-if="active.length">
      <p class="eyebrow mt-5">Aktif ({{ active.length }})</p>
      <button v-for="b in active" :key="b.id" class="card mt-2 block w-full p-4 text-left active:translate-y-[2px] active:shadow-none transition" @click="open(b)">
        <div class="flex items-center justify-between gap-2">
          <b class="text-lg">{{ b.title }}</b>
          <span class="chip bg-warn-soft text-warn-ink">{{ b.summary.paidCount }} dari {{ b.participants.length }} bayar</span>
        </div>
        <div class="mt-1 flex items-end justify-between text-sm font-bold text-muted">
          <span>{{ formatDate(b.billDate) }} · sisa {{ rupiah(b.summary.remaining) }}</span>
          <b class="text-lg text-ink">{{ rupiah(b.summary.grandTotal) }}</b>
        </div>
      </button>
    </template>

    <template v-if="done.length">
      <p class="eyebrow mt-5">Selesai ({{ done.length }})</p>
      <button v-for="b in done" :key="b.id" class="card mt-2 block w-full p-4 text-left active:translate-y-[2px] active:shadow-none transition" @click="open(b)">
        <div class="flex items-center justify-between gap-2">
          <b class="text-lg">{{ b.title }}</b>
          <span class="chip bg-ok-soft text-ok-ink">Lunas</span>
        </div>
        <div class="mt-1 flex items-end justify-between text-sm font-bold text-muted">
          <span>{{ formatDate(b.billDate) }} · {{ b.participants.length }} orang</span>
          <b class="text-lg text-ink">{{ rupiah(b.summary.grandTotal) }}</b>
        </div>
      </button>
    </template>

    <div class="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md bg-gradient-to-t from-page via-page to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button class="btn-primary w-full py-4 text-base" @click="router.push({ name: 'new' })"><span class="text-xl leading-none">+</span> Buat split bill baru</button>
    </div>
    <ThemeSheet v-if="showTheme" @close="showTheme = false" />
  </main>
</template>