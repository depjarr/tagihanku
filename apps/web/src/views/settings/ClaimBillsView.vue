<script setup>
// Memindahkan tagihan yang dibuat TANPA akun di perangkat ini ke akun yang sedang login.
// (Saat login/daftar hal ini juga terjadi otomatis; halaman ini untuk jaga-jaga / tagihan baru.)
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../../api/auth'
import { billsApi } from '../../api/bills'
import { myBills } from '../../composables/useMyBills'
import { formatDate, rupiah } from '../../composables/useFormat'

const router = useRouter()
const loading = ref(true)
const pending = ref([])
const msg = ref('')
const error = ref('')
const busy = ref(false)

async function load() {
  loading.value = true
  try {
    const ids = myBills.ids()
    const bills = ids.length ? await billsApi.list(ids) : []
    pending.value = bills.filter((b) => !b.isMine) // belum tertaut ke akun ini
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

async function claim() {
  busy.value = true
  error.value = msg.value = ''
  try {
    const keep = new Set(pending.value.map((b) => b.id))
    const items = myBills.all().filter((b) => keep.has(b.id)).map((b) => ({ id: b.id, token: b.token }))
    const { claimed } = await authApi.claimBills(items)
    msg.value = claimed ? `${claimed} tagihan dipindahkan ke akunmu` : 'Tidak ada tagihan yang bisa dipindahkan (mungkin sudah tertaut ke akun lain)'
    await load()
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <main class="screen">
    <button class="btn-pill" @click="router.push({ name: 'settings' })">Kembali</button>
    <h1 class="h1">Pindahkan tagihan</h1>
    <p class="mt-2 text-sm text-muted">Tagihan yang kamu buat tanpa akun di perangkat ini bisa dipindahkan ke akunmu, jadi terbuka dari perangkat mana saja.</p>

    <p v-if="loading" class="mt-6 text-muted">Memuat…</p>
    <p v-if="msg" class="notice-ok mt-4">{{ msg }}</p>
    <p v-if="error" class="notice mt-4">{{ error }}</p>

    <p v-if="!loading && !pending.length" class="card mt-6 text-center text-muted">Tidak ada tagihan yang perlu dipindahkan.</p>
    <template v-else-if="!loading">
      <button v-for="b in pending" :key="b.id" class="card mt-2 block w-full text-left" @click="router.push({ name: 'summary', params: { id: b.id } })">
        <div class="flex items-center justify-between gap-2"><b>{{ b.title }}</b><b>{{ rupiah(b.summary.grandTotal) }}</b></div>
        <span class="text-sm text-muted">{{ formatDate(b.billDate) }} · {{ b.participants.length }} orang</span>
      </button>
      <div class="bar"><button class="btn-primary" :disabled="busy" @click="claim">Pindahkan {{ pending.length }} tagihan</button></div>
    </template>
  </main>
</template>
