<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ItemRow from '../components/ItemRow.vue'
import ParticipantChip from '../components/ParticipantChip.vue'
import PaymentMethodsEditor from '../components/PaymentMethodsEditor.vue'
import ReceiptUploader from '../components/ReceiptUploader.vue'
import { billsApi } from '../api/bills'
import { isOwner } from '../composables/useMyBills'
import { useAuthStore } from '../stores/authStore'
import { formatTaxService, parseTaxService, rupiah, todayISO, toInt } from '../composables/useFormat'
import { useBillStore } from '../stores/billStore'

const route = useRoute()
const router = useRouter()
const store = useBillStore()

const billId = computed(() => route.params.id)
const auth = useAuthStore()
const isNew = computed(() => !billId.value)
const bill = computed(() => store.bill)
const error = ref('')

/* ---------- Langkah 1: tagihan baru ---------- */
const blankForm = () => ({
  title: '',
  billDate: todayISO(),
  taxText: '10% + 5%', // satu kolom: "pajak + service"
  ownerName: '',
  others: [],
  paymentMethods: [],
})
const form = reactive(blankForm())
const newName = ref('')
const ownerLocked = computed(() => !!auth.user) // sudah login → nama pembuat = nama akun

/* "Split bill baru, peserta sama": /new?from=<id tagihan lama> mengisi peserta, pajak, dan metode bayar */
const fromId = computed(() => (typeof route.query.from === 'string' ? route.query.from : ''))
const source = ref(null) // tagihan sumber (untuk teks petunjuk)
const touchedMethods = ref(false)
const clone = (v) => JSON.parse(JSON.stringify(v || []))

async function prefillFromSource() {
  if (!fromId.value) return
  try {
    const src = await billsApi.get(fromId.value)
    source.value = src
    const owner = src.participants.find((p) => p.isOwner)
    Object.assign(form, {
      taxText: formatTaxService(src.taxPercent, src.servicePercent),
      ownerName: auth.user?.name || owner?.name || '',
      others: src.participants.filter((p) => !p.isOwner).map((p) => p.name),
      paymentMethods: src.paymentMethods.map((m) => ({
        type: m.type, label: m.label, accountNumber: m.accountNumber || '', accountName: m.accountName || '',
        qrisPayload: m.qrisPayload || undefined,
      })),
    })
    touchedMethods.value = true
  } catch (e) {
    error.value = 'Tagihan sebelumnya tidak ditemukan; mulai dari kosong.'
  }
}
function startBlank() {
  Object.assign(form, blankForm())
  if (auth.user) form.ownerName = auth.user.name
  form.paymentMethods = clone(auth.settings.defaultPaymentMethods)
  source.value = null
  router.replace({ name: 'new' })
}

// metode pembayaran bawaan akun terisi otomatis (kalau belum disentuh dan bukan dari tagihan lama)
watch(
  () => auth.settings.defaultPaymentMethods,
  (v) => { if (isNew.value && !fromId.value && !touchedMethods.value) form.paymentMethods = clone(v) },
  { immediate: true },
)
watch(() => auth.user, (u) => { if (u && isNew.value && !form.ownerName) form.ownerName = u.name })

function addPerson() {
  const n = newName.value.trim()
  const all = [form.ownerName, ...form.others].map((x) => x.trim().toLowerCase())
  if (n && !all.includes(n.toLowerCase())) form.others.push(n)
  newName.value = ''
}

async function start(mode) {
  error.value = ''
  if (!form.title.trim()) return (error.value = 'Judul wajib diisi')
  if (!form.ownerName.trim()) return (error.value = 'Isi namamu sebagai pembuat tagihan')
  if (!form.others.length) return (error.value = 'Tambahkan minimal satu teman')
  const { tax, service } = parseTaxService(form.taxText)
  try {
    const created = await store.create({
      title: form.title,
      billDate: form.billDate,
      taxPercent: tax,
      servicePercent: service,
      participants: [form.ownerName, ...form.others],
      paymentMethods: form.paymentMethods.map((m) => ({
        type: m.type,
        label: m.label,
        accountNumber: m.accountNumber || undefined,
        accountName: m.accountName || undefined,
        qrisPayload: m.type === 'QRIS' ? m.qrisPayload : undefined,
      })),
    })
    router.replace({ name: 'edit', params: { id: created.id }, query: mode === 'scan' ? { scan: 1 } : {} })
  } catch (e) {
    error.value = e.message
  }
}

/* ---------- Langkah 2: item ---------- */
const scanning = ref(route.query.scan === '1')
const item = reactive({ name: '', price: '' })

onMounted(async () => {
  if (isNew.value) {
    if (auth.user && !form.ownerName) form.ownerName = auth.user.name
    await prefillFromSource()
    return
  }
  if (store.bill?.id !== billId.value) await store.load(billId.value)
  if (!isOwner(billId.value) && !store.isMine) return router.replace({ name: 'summary', params: { id: billId.value } })
  if (bill.value?.items.length) scanning.value = false
})

async function toggle(it, pid) {
  const ids = new Set(it.participantIds)
  ids.has(pid) ? ids.delete(pid) : ids.add(pid)
  await run(() => store.setAssignments(it.id, [...ids]))
}
async function addItem() {
  const price = toInt(item.price)
  if (!item.name.trim() || !price) return
  await run(() => store.addItem({ name: item.name.trim(), price }))
  Object.assign(item, { name: '', price: '' })
}
async function onScanned(lines, patch) {
  await run(async () => {
    await store.bulkItems(lines)
    // samakan pajak, service, dan tanggal dengan struk (hanya yang berubah)
    const b = store.bill
    const diff = {}
    if (patch?.taxPercent !== undefined && patch.taxPercent !== b.taxPercent) diff.taxPercent = patch.taxPercent
    if (patch?.servicePercent !== undefined && patch.servicePercent !== b.servicePercent) diff.servicePercent = patch.servicePercent
    if (patch?.billDate && patch.billDate !== b.billDate) diff.billDate = patch.billDate
    if (Object.keys(diff).length) await store.update(diff)
  })
  if (!error.value) scanning.value = false
}
async function addPerson2() {
  const n = newName.value.trim()
  if (!n) return
  await run(() => store.addParticipant(n))
  newName.value = ''
}
async function run(fn) {
  error.value = ''
  try { await fn() } catch (e) { error.value = e.message }
}

const unassigned = computed(() => bill.value?.summary.unassignedItemIds.length ?? 0)
</script>

<template>
  <!-- ===== Langkah 1 ===== -->
  <main v-if="isNew" class="screen !pb-52">
    <p class="eyebrow">{{ source ? 'Tagihan kedua' : 'Langkah 1 dari 3' }}</p>
    <h1 class="h1">{{ source ? 'Split bill baru' : 'Tagihan baru' }}</h1>
    <p v-if="source" class="mt-1 text-sm text-muted">
      Diisi dari "{{ source.title }}": peserta, pajak, dan metode pembayaran.
    </p>

    <section class="card mt-4 space-y-4">
      <div>
        <label class="label">Judul</label>
        <input v-model="form.title" class="input" placeholder="Mis. Makan siang tim" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Tanggal</label>
          <input v-model="form.billDate" type="date" class="input" />
        </div>
        <div>
          <label class="label">Pajak + service</label>
          <input v-model="form.taxText" class="input" inputmode="decimal" placeholder="10% + 5%" aria-describedby="taxHint" />
        </div>
      </div>
      <p id="taxHint" class="-mt-2 text-xs text-muted">Tulis "pajak + service", mis. 10% + 5%. Isi 0 kalau tidak ada.</p>
    </section>

    <section class="card mt-3">
      <label class="label">Peserta</label>
      <input
        v-if="!ownerLocked" v-model="form.ownerName" class="input mb-3" placeholder="Namamu (pembuat tagihan)"
      />
      <div class="flex flex-wrap gap-2">
        <ParticipantChip v-if="ownerLocked && form.ownerName" :name="`${form.ownerName} (kamu)`" />
        <ParticipantChip
          v-for="(n, i) in form.others"
          :key="n"
          :name="n"
          removable
          @remove="form.others.splice(i, 1)"
        />
      </div>
      <div class="mt-3 flex gap-2">
        <input v-model="newName" class="input" placeholder="Nama teman" @keyup.enter="addPerson" />
        <button class="btn-pill shrink-0" @click="addPerson">+ Tambah</button>
      </div>
    </section>

    <section class="card mt-3">
      <label class="label">Metode pembayaran</label>
      <PaymentMethodsEditor v-model="form.paymentMethods" @update:model-value="touchedMethods = true" />
    </section>

    <p v-if="error" class="notice mt-3">{{ error }}</p>
    <div class="bar space-y-3">
      <button class="btn-primary" @click="start('scan')">Scan struk</button>
      <button class="btn-outline" @click="start('manual')">Isi manual</button>
      <button v-if="source" class="w-full py-1 text-sm font-bold text-muted" @click="startBlank">Mulai dari kosong</button>
    </div>
  </main>

  <!-- ===== Scan struk ===== -->
  <main v-else-if="scanning && bill" class="screen !pb-44">
    <ReceiptUploader @confirm="onScanned" @manual="scanning = false" />
    <p v-if="error" class="notice mt-3">{{ error }}</p>
  </main>

  <!-- ===== Langkah 2 ===== -->
  <main v-else-if="bill" class="screen !pb-44">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="eyebrow">Langkah 2 dari 3</p>
        <h1 class="h1">{{ bill.title }}</h1>
      </div>
      <button class="btn-pill mt-1" @click="scanning = true">Scan struk</button>
    </div>

    <section class="card mt-4">
      <div class="flex flex-wrap gap-2">
        <ParticipantChip
          v-for="p in bill.participants"
          :key="p.id"
          :name="p.name"
          :removable="!p.isOwner"
          @remove="run(() => store.removeParticipant(p.id))"
        />
      </div>
      <div class="mt-3 flex gap-2">
        <input v-model="newName" class="input" placeholder="Tambah peserta" @keyup.enter="addPerson2" />
        <button class="btn-pill shrink-0" @click="addPerson2">+ Tambah</button>
      </div>
    </section>

    <p class="eyebrow mt-5">Item (tap nama untuk membagi)</p>
    <div class="mt-2 space-y-3">
      <ItemRow
        v-for="it in bill.items"
        :key="it.id"
        :item="it"
        :participants="bill.participants"
        @toggle="(pid) => toggle(it, pid)"
        @update="(patch) => run(() => store.updateItem(it.id, patch))"
        @remove="run(() => store.removeItem(it.id))"
      />
      <div class="card flex gap-2 p-3">
        <input v-model="item.name" class="input" placeholder="Nama item" />
        <input v-model="item.price" class="input w-32 text-right" inputmode="numeric" placeholder="Harga" @keyup.enter="addItem" />
        <button class="btn-pill shrink-0" @click="addItem">+</button>
      </div>
    </div>

    <p v-if="unassigned" class="notice mt-3">{{ unassigned }} item belum dipilih pesertanya — belum ikut dihitung.</p>
    <p v-if="error" class="notice mt-3">{{ error }}</p>

    <div class="bar">
      <div class="mb-3 flex items-end justify-between px-1">
        <span class="text-muted">Subtotal + pajak + service</span>
        <b class="text-2xl">{{ rupiah(bill.summary.expectedTotal) }}</b>
      </div>
      <button class="btn-primary" :disabled="!bill.items.length" @click="router.push({ name: 'summary', params: { id: bill.id } })">
        Lihat ringkasan
      </button>
    </div>
  </main>

  <main v-else class="screen">
    <p v-if="store.loading" class="text-muted">Memuat…</p>
    <p v-else class="notice">{{ store.error || 'Tagihan tidak ditemukan' }}</p>
  </main>
</template>
