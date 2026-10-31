<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClipboard } from '../composables/useClipboard'
import { formatDate, formatDateTime, formatTaxService, rupiah, shareUrl } from '../composables/useFormat'
import { isOwner } from '../composables/useMyBills'
import { useBillStore } from '../stores/billStore'

const route = useRoute()
const router = useRouter()
const store = useBillStore()
const { copied, copy } = useClipboard()

const id = route.params.id
const owner = computed(() => isOwner(id) || store.isMine)
const bill = computed(() => store.bill)
const s = computed(() => bill.value?.summary)
const done = computed(() => bill.value?.status === 'DONE')
const link = computed(() => (bill.value ? shareUrl(bill.value.shareCode) : ''))
const error = ref('')

onMounted(() => store.load(id))

// "Tagihan dipindah ke daftar Selesai" hanya muncul tepat setelah tagihan lunas di layar ini
const justDone = ref(false)
// (hanya bila statusnya berubah ACTIVE → DONE di layar ini, bukan saat membuka tagihan yang memang sudah selesai)
watch(() => bill.value?.status, (now, before) => { if (now === 'DONE' && before === 'ACTIVE') justDone.value = true })
// "Salah tandai? Ubah status": tampilkan tombol batal lunas per orang
const editStatus = ref(false)
watch(done, (now) => { if (!now) editStatus.value = false })

async function run(fn) {
  error.value = ''
  try { await fn() } catch (e) { error.value = e.message }
}
const togglePaid = (sh) => run(() => store.setPaid(sh.participantId, !sh.paid))

const waLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`
const shareText = computed(() => `Tagihan "${bill.value?.title}" — cek bagianmu & cara bayarnya di sini: ${link.value}`)
const remindText = (sh) =>
  `Hai ${sh.name}, pengingat bagianmu di "${bill.value.title}": ${rupiah(sh.total)}. Detail & cara bayar: ${link.value}`

const feeTotal = computed(() => (s.value?.shares || []).reduce((a, x) => a + x.feeTotal, 0))
const feeLabel = computed(() => `Pajak + service ${formatTaxService(bill.value.taxPercent, bill.value.servicePercent)}`)
const isOwnerPerson = (sh) => !!bill.value.participants.find((p) => p.id === sh.participantId)?.isOwner
const paidInfo = (sh) => {
  if (isOwnerPerson(sh)) return 'pembuat'
  return sh.paid && sh.paidAt ? `lunas ${formatDateTime(sh.paidAt)}` : sh.paid ? 'lunas' : 'belum bayar'
}

const newFromThis = () => router.push({ name: 'new', query: { from: bill.value.id } })
const viewFriendPage = () => router.push({ name: 'shared', params: { code: bill.value.shareCode } })

async function destroy() {
  if (!confirm('Hapus tagihan ini? Data tidak bisa dikembalikan.')) return
  await run(async () => {
    await store.remove(id)
    router.replace({ name: 'home' })
  })
}
</script>

<template>
  <main v-if="bill" class="screen">
    <div class="flex items-center justify-between">
      <button class="btn-pill" @click="router.push({ name: 'home' })">Kembali</button>
      <span v-if="done" class="rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok-ink">Selesai</span>
    </div>

    <p class="eyebrow mt-5">{{ owner ? (done ? 'Mode pembuat' : 'Mode pembuat · Tahap 3') : 'Hanya lihat' }}</p>
    <h1 class="h1">{{ bill.title }}</h1>
    <p class="text-sm text-muted">{{ formatDate(bill.billDate) }} · Total {{ rupiah(s.grandTotal) }}</p>

    <!-- ================= SEMUA LUNAS ================= -->
    <template v-if="done">
      <section class="mt-4 rounded-3xl bg-ok p-5 text-white">
        <p class="text-2xl font-extrabold">Semua sudah bayar</p>
        <p class="text-sm opacity-90">{{ rupiah(s.paidTotal) }} terkumpul dari {{ bill.participants.length }} orang</p>
      </section>

      <p v-if="justDone" class="notice-ok mt-3">
        Tagihan dipindah ke daftar Selesai. Datanya tetap tersimpan dan bisa dibuka kapan saja.
      </p>

      <p class="eyebrow mt-6">Pembayaran</p>
      <section class="card mt-2 !py-1">
        <div v-for="sh in s.shares" :key="sh.participantId" class="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
          <div class="min-w-0">
            <b>{{ sh.name }}</b>
            <p class="text-sm text-muted">{{ rupiah(sh.total) }} · {{ paidInfo(sh) }}</p>
          </div>
          <button v-if="owner && editStatus" class="btn-pill shrink-0 !px-3 !py-1" @click="togglePaid(sh)">Batalkan lunas</button>
          <span v-else class="shrink-0 rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok-ink">Lunas</span>
        </div>
      </section>

      <p class="eyebrow mt-6">Rincian item</p>
      <section class="card mt-2 !py-1 text-sm">
        <div v-for="it in bill.items" :key="it.id" class="flex justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
          <span>{{ it.name }}</span><b>{{ rupiah(it.price).slice(3) }}</b>
        </div>
        <div v-if="feeTotal" class="flex justify-between gap-3 py-2.5 text-muted">
          <span>{{ feeLabel }}</span><b class="text-ink">{{ rupiah(feeTotal).slice(3) }}</b>
        </div>
      </section>

      <p v-if="error" class="notice mt-3">{{ error }}</p>

      <div class="mt-6 space-y-3">
        <template v-if="owner">
          <button class="btn-primary" @click="newFromThis">Split bill baru, peserta sama</button>
          <button class="btn-outline" @click="viewFriendPage">Lihat halaman teman</button>
          <button class="w-full py-2 text-sm font-bold text-muted underline" @click="editStatus = !editStatus">
            {{ editStatus ? 'Selesai mengubah status' : 'Salah tandai? Ubah status' }}
          </button>
          <button class="w-full py-1 text-sm font-bold text-brand-ink" @click="router.push({ name: 'home' })">Lihat daftar tagihan</button>
          <button class="w-full py-2 text-sm font-bold text-danger underline" @click="destroy">Hapus tagihan</button>
        </template>
        <button v-else class="btn-outline" @click="viewFriendPage">Lihat halaman teman</button>
      </div>
    </template>

    <!-- ================= MASIH BERJALAN ================= -->
    <template v-else>
      <section class="card mt-4">
        <div class="flex items-baseline justify-between">
          <b class="text-lg">{{ s.paidCount }} dari {{ bill.participants.length }} sudah bayar</b>
          <span class="text-sm text-muted">Sisa {{ rupiah(s.remaining) }}</span>
        </div>
        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-line/60">
          <div class="h-full rounded-full bg-brand-ink" :style="{ width: `${s.paidTotal && s.grandTotal ? (s.paidTotal / s.grandTotal) * 100 : 0}%` }" />
        </div>
      </section>

      <p v-if="owner" class="notice mt-3">Hanya kamu yang bisa mengubah status. Teman hanya bisa melihat dan membayar.</p>
      <p v-if="s.unassignedItemIds.length" class="notice mt-3">
        {{ s.unassignedItemIds.length }} item ({{ rupiah(s.unassignedSubtotal) }}) belum dibagi ke siapa pun.
      </p>

      <!-- Per orang -->
      <div class="mt-4 space-y-3">
        <article
          v-for="sh in s.shares"
          :key="sh.participantId"
          class="card"
          :class="{ 'border-2 border-warn': !sh.paid && owner }"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <b class="text-lg">{{ sh.name }}</b>
              <p class="text-sm text-muted">
                Item {{ rupiah(sh.itemTotal).slice(3) }} + pajak &amp; service {{ rupiah(sh.feeTotal).slice(3) }}
                <template v-if="isOwnerPerson(sh)"> · pembuat</template>
                <template v-else-if="sh.paid && sh.paidAt"> · lunas {{ formatDateTime(sh.paidAt) }}</template>
              </p>
            </div>
            <div class="text-right">
              <b class="block text-xl text-brand-ink">{{ rupiah(sh.total) }}</b>
              <button v-if="owner" class="btn-pill mt-1 !px-3 !py-1" @click="togglePaid(sh)">
                {{ sh.paid ? 'Lunas ✓' : 'Tandai lunas' }}
              </button>
              <span v-else class="text-xs font-bold" :class="sh.paid ? 'text-ok-ink' : 'text-warn-ink'">{{ sh.paid ? 'Lunas' : 'Belum bayar' }}</span>
            </div>
          </div>
          <a v-if="owner && !sh.paid" :href="waLink(remindText(sh))" target="_blank" rel="noopener" class="btn-outline mt-3 block !py-2.5 text-sm">
            Ingatkan {{ sh.name }} via WhatsApp
          </a>
        </article>
      </div>

      <p v-if="s.grandTotal === s.expectedTotal && !s.unassignedItemIds.length" class="notice-ok mt-3">
        Total {{ bill.participants.length }} porsi = {{ rupiah(s.grandTotal) }}, pas dengan struk
      </p>

      <!-- Metode pembayaran -->
      <p class="eyebrow mt-6">Bayar lewat</p>
      <div class="mt-2 space-y-2">
        <div v-for="m in bill.paymentMethods" :key="m.id" class="card flex items-center justify-between gap-3">
          <div class="min-w-0">
            <b>{{ m.type === 'QRIS' ? `QRIS · ${m.label}` : m.label }}</b>
            <p v-if="m.accountNumber" class="truncate text-sm text-muted">{{ m.accountNumber }}<template v-if="m.accountName"> · a.n. {{ m.accountName }}</template></p>
            <p v-else-if="m.type === 'QRIS' && m.qrisPayload" class="text-sm text-muted">Nominal terisi otomatis di halaman teman</p>
          </div>
          <button v-if="m.accountNumber" class="btn-pill shrink-0" @click="copy(m.accountNumber, m.id)">
            {{ copied === m.id ? 'Tersalin' : 'Salin' }}
          </button>
        </div>
        <p v-if="!bill.paymentMethods.length" class="text-sm text-muted">Belum ada metode pembayaran.</p>
      </div>

      <p v-if="error" class="notice mt-3">{{ error }}</p>

      <!-- Aksi pembuat -->
      <template v-if="owner">
        <p class="eyebrow mt-6">Link berbagi</p>
        <button class="input mt-2 text-left text-sm" @click="copy(link, 'link')">{{ copied === 'link' ? 'Tersalin ✓' : link }}</button>
        <div class="mt-4 space-y-3">
          <a :href="waLink(shareText)" target="_blank" rel="noopener" class="btn-primary block">Bagikan ke WhatsApp</a>
          <button class="btn-outline" @click="router.push({ name: 'edit', params: { id: bill.id } })">Ubah item &amp; pembagian</button>
          <button class="btn-outline" @click="newFromThis">Split bill baru, peserta sama</button>
          <button class="w-full py-2 text-sm font-bold text-danger underline" @click="destroy">Hapus tagihan</button>
        </div>
      </template>
    </template>
  </main>

  <main v-else class="screen">
    <p v-if="store.loading" class="text-muted">Memuat…</p>
    <p v-else class="notice">{{ store.error || 'Tagihan tidak ditemukan' }}</p>
  </main>
</template>
