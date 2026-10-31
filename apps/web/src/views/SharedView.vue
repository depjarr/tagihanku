<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ParticipantChip from '../components/ParticipantChip.vue'
import QrisCard from '../components/QrisCard.vue'
import { billsApi } from '../api/bills'
import { useClipboard } from '../composables/useClipboard'
import { rupiah } from '../composables/useFormat'
import { useBillStore } from '../stores/billStore'

const route = useRoute()
const store = useBillStore()
const { copied, copy } = useClipboard()

const code = route.params.code
const KEY = `splitbill.me.${code}`
const meId = ref(null)

onMounted(async () => {
  await store.loadShared(code)
  try { meId.value = localStorage.getItem(KEY) } catch { /* abaikan */ }
  if (meId.value && !bill.value?.participants.some((p) => p.id === meId.value)) meId.value = null // peserta sudah dihapus
  if (meId.value) notifyOpened(meId.value)
})

const bill = computed(() => store.bill)
const me = computed(() => bill.value?.summary.shares.find((s) => s.participantId === meId.value))
const creator = computed(() => bill.value?.participants.find((p) => p.isOwner)?.name)

// Beri tahu pembuat bahwa link dibuka (server hanya mengirim notifikasi sekali per peserta)
function notifyOpened(pid) {
  billsApi.markOpened(code, pid).catch(() => { /* tidak penting bagi teman */ })
}
function pick(id) {
  meId.value = id
  try { localStorage.setItem(KEY, id) } catch { /* abaikan */ }
  notifyOpened(id)
}
</script>

<template>
  <main v-if="bill" class="screen">
    <div class="flex items-center justify-between">
      <b class="text-lg text-brand-ink">Tagihanku</b>
      <span class="text-sm text-muted">Hanya lihat · tanpa login</span>
    </div>
    <p class="eyebrow mt-5">Tagihan dari {{ creator }}</p>
    <h1 class="h1">{{ bill.title }}</h1>

    <!-- Pilih nama -->
    <section v-if="!me" class="card mt-4">
      <p class="label">Kamu yang mana?</p>
      <div class="flex flex-wrap gap-2">
        <ParticipantChip v-for="p in bill.participants" :key="p.id" :name="p.name" :active="false" @click="pick(p.id)" />
      </div>
    </section>

    <template v-else>
      <section class="mt-4 rounded-3xl bg-brand p-5 text-on-brand">
        <div class="flex items-center justify-between text-sm font-bold">
          <span>Bagian {{ me.name }}</span>
          <button class="underline" @click="meId = null">Bukan kamu? Ganti</button>
        </div>
        <p class="mt-1 text-4xl font-extrabold">{{ rupiah(me.total) }}</p>
        <p class="text-sm opacity-90">
          Item {{ rupiah(me.itemTotal).slice(3) }} + pajak &amp; service {{ rupiah(me.feeTotal).slice(3) }} ·
          {{ me.paid ? 'Sudah lunas' : 'Belum bayar' }}
        </p>
      </section>

      <p class="eyebrow mt-6">Bayar lewat</p>
      <div class="mt-2 space-y-3">
        <template v-for="m in bill.paymentMethods" :key="m.id">
          <!-- QRIS dengan nominal bagian si teman sudah terisi -->
          <QrisCard v-if="m.type === 'QRIS' && m.qrisPayload && !me.paid" :payload="m.qrisPayload" :amount="me.total" :label="m.label" />
          <div v-else class="card flex items-center justify-between gap-3">
            <div class="min-w-0">
              <b>{{ m.type === 'QRIS' ? `QRIS · ${m.label}` : m.label }}</b>
              <p v-if="m.accountNumber" class="truncate text-sm text-muted">
                {{ m.accountNumber }}<template v-if="m.accountName"> · a.n. {{ m.accountName }}</template>
              </p>
            </div>
            <button v-if="m.accountNumber" class="btn-pill shrink-0" @click="copy(m.accountNumber, m.id)">
              {{ copied === m.id ? 'Tersalin' : 'Salin' }}
            </button>
          </div>
        </template>
        <p v-if="!bill.paymentMethods.length" class="text-sm text-muted">Pembuat belum menambahkan metode pembayaran.</p>
      </div>
    </template>

    <p class="mt-8 text-center text-sm text-muted">
      Status lunas dikonfirmasi oleh {{ creator }} setelah ia mengecek pembayaran.
    </p>
  </main>

  <main v-else class="screen">
    <p v-if="store.loading" class="text-muted">Memuat…</p>
    <p v-else class="notice">{{ store.error || 'Link tidak ditemukan' }}</p>
  </main>
</template>
