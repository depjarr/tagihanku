<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { syncApi } from '../api/sync'
import { toDynamicQris, isValidQris, merchantName, merchantNmid } from '../composables/useQris'
import { decodeQrFromFile, drawQr, qrToDataUrl } from '../composables/useQrScan'
import { prepareReceiptImage } from '../composables/useReceiptImage'
import { computeSplit, itemShares, itemMembers, itemWeights, modeBalance, distribute, SPLIT_MODES } from '../composables/useSplit'
import { formatRupiah, formatDate, makeReceiptNo } from '../composables/format'
import { toast, askConfirm } from '../composables/useToast'
import CameraCapture from '../components/CameraCapture.vue'
import CatMascot from '../components/CatMascot.vue'
import PaidReceiptModal from '../components/PaidReceiptModal.vue'
import ThemeSheet from '../components/ThemeSheet.vue'
import WelcomeIntro from '../components/WelcomeIntro.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const router = useRouter()
const auth = useAuthStore()
const goAccount = () => router.push({ name: auth.loggedIn ? 'settings' : 'login' })

// Ubah ke true kalau pengenalan mau muncul setiap aplikasi dibuka (bukan hanya pertama kali).
const SHOW_WELCOME_EVERY_VISIT = false

// ==========================================
// 1. STATE NAVIGASI (STEP 0 - 8)
// ==========================================
// 0: Beranda / riwayat tagihan   1: Pilih cara (struk AI / manual)   2: Kamera
// 3: Preview foto   4: AI membaca struk   5: Review & edit menu
// 6: Pilih anggota   7: Atur pembagian   8: Rincian, tandai lunas, QRIS, WhatsApp
const step = ref(0)

const KEY_BILLS = 'tagihanku_bills_history'
const KEY_PAYMENTS = 'tagihanku_payment_methods'
const KEY_FRIENDS = 'tagihanku_recent_friends'
const KEY_WELCOME = 'tagihanku_seen_welcome'

const showWelcome = ref(false)
const showTheme = ref(false)
const showPaymentModal = ref(false)
const activeModalItem = ref(null)
const activeQrisModal = ref(null)
const receiptView = ref(null)
const qrCanvas = ref(null)
const splitTab = ref('menu') // 'menu' | 'orang'
const expanded = ref({})

const selectedFile = ref(null)
const receiptPhotoUrl = ref('')
const scanError = ref('')
let scanAbort = null

// ---- util penyimpanan aman (mode privat bisa melempar error)
const read = (k, fallback) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fallback } catch { return fallback } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { toast.error('Penyimpanan HP penuh / diblokir, data tidak bisa disimpan.') } }

// ==========================================
// 2. ANGGOTA (DAFTAR TEMAN)
// ==========================================
const OWNER = { id: 'me', name: 'Kamu', phone: 'Pembuat', wa: '', bg: '#FFEAE5', avatar: '🐱', isOwner: true }
const participants = ref([])
const selectedMemberIds = ref(['me'])
const newFriend = reactive({ name: '', wa: '' })

const owner = computed(() => participants.value.find((p) => p.isOwner) || OWNER)
const ownerName = computed({
  get: () => owner.value.name,
  set: (v) => { owner.value.name = v; saveRoster() },
})
const memberById = (id) => participants.value.find((p) => p.id === id)
const memberIds = computed(() => selectedMemberIds.value.filter((id) => memberById(id)))
const selectedMembers = computed(() => memberIds.value.map(memberById))

const saveRoster = () => { write(KEY_FRIENDS, participants.value); queueProfile() }

function addNewFriend() {
  const name = newFriend.name.trim()
  if (!name) return toast.info('Isi nama temanmu dulu ya.')
  if (participants.value.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast.warn('Nama teman itu sudah ada.')
  const avatars = ['🐰', '🐻', '🐼', '🦊', '🐶', '🐣', '🐨', '🐹']
  const bgs = ['#FADBD8', '#FDEBD0', '#D4E6F1', '#E8DAEF', '#D1F2EB', '#FCF3CF']
  const p = {
    id: 'friend_' + Date.now(), name, phone: 'Teman', wa: newFriend.wa.replace(/[^\d+]/g, ''),
    bg: bgs[Math.floor(Math.random() * bgs.length)], avatar: avatars[Math.floor(Math.random() * avatars.length)],
    isOwner: false,
  }
  participants.value.push(p)
  selectedMemberIds.value.push(p.id)
  saveRoster()
  newFriend.name = ''
  newFriend.wa = ''
  toast.success(`${name} ditambahkan 🎉`)
}

function toggleMember(id) {
  if (id === 'me') return
  const i = selectedMemberIds.value.indexOf(id)
  if (i > -1) selectedMemberIds.value.splice(i, 1)
  else selectedMemberIds.value.push(id)
}

async function removeFriend(id) {
  if (id === 'me') return
  const p = memberById(id)
  if (!(await askConfirm({ title: `Hapus ${p?.name}?`, message: 'Dia hilang dari daftar teman (tagihan lama tidak berubah).', okText: 'Hapus', danger: true }))) return
  participants.value = participants.value.filter((x) => x.id !== id)
  selectedMemberIds.value = selectedMemberIds.value.filter((x) => x !== id)
  saveRoster()
}

/** nomor WhatsApp → format internasional tanpa "+" (0812… → 62812…) */
function waNumber(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('0')) return '62' + d.slice(1)
  if (d.startsWith('8')) return '62' + d
  return d
}

// ==========================================
// 3. DATA TAGIHAN AKTIF
// ==========================================
const currentBillId = ref(null)
const bill = reactive({
  title: '', date: new Date().toISOString().slice(0, 10),
  tax: 0, serviceCharge: 0, discount: 0, aiTotal: 0,
  items: [], payments: {},
})
const manualItem = reactive({ name: '', price: '', qty: 1 })

const subtotal = computed(() => bill.items.reduce((s, it) => s + (Number(it.price) || 0), 0))
const grandTotal = computed(() => subtotal.value + (Number(bill.tax) || 0) + (Number(bill.serviceCharge) || 0) - (Number(bill.discount) || 0))

function makeItem(src, i = 0) {
  return {
    id: src.id ?? Date.now() + i,
    name: src.name || `Item ${i + 1}`,
    qty: Number(src.qty) || 1,
    price: Number(src.price) || 0,
    splitMode: SPLIT_MODES.some((m) => m.value === src.splitMode) ? src.splitMode : 'equal',
    assignedTo: Array.isArray(src.assignedTo) ? [...src.assignedTo] : [],
    weights: { ...(src.weights || {}) },
    touched: src.touched ?? true, // item lama dianggap sudah diatur
  }
}

function addManualItem() {
  const name = manualItem.name.trim()
  const price = Number(manualItem.price)
  if (!name || !(price > 0)) return toast.info('Isi nama menu dan harganya dulu ya.')
  bill.items.push(makeItem({ name, price, qty: manualItem.qty, touched: false }))
  manualItem.name = ''
  manualItem.price = ''
  manualItem.qty = 1
}
const removeBillItem = (id) => { bill.items = bill.items.filter((it) => it.id !== id) }

const receiptGap = computed(() => (bill.aiTotal ? bill.aiTotal - grandTotal.value : 0))
function matchReceiptTotal() {
  const gap = receiptGap.value
  if (!gap) return
  if (gap < 0) bill.discount = (Number(bill.discount) || 0) + Math.abs(gap)
  else bill.serviceCharge = (Number(bill.serviceCharge) || 0) + gap
  toast.success('Total disesuaikan dengan total di struk.')
}

// ==========================================
// 4. PERHITUNGAN PEMBAGIAN
// ==========================================
const split = computed(() =>
  computeSplit({ items: bill.items, memberIds: memberIds.value, tax: bill.tax, serviceCharge: bill.serviceCharge, discount: bill.discount }),
)
const rows = computed(() => split.value.rows.map((r) => ({ ...r, member: memberById(r.id) })))
const rowOf = (id) => split.value.rows.find((r) => r.id === id)

// ==========================================
// 5. LUNAS & STRUK LUNAS (hanya dilihat pembuat)
// ==========================================
const isPaid = (id) => id === 'me' || !!bill.payments[id]?.paid
const paidCount = computed(() => memberIds.value.filter(isPaid).length)

function markPaid(row) {
  const name = row.member.name
  bill.payments[row.id] = {
    paid: true,
    paidAt: new Date().toISOString(),
    receiptNo: makeReceiptNo(),
    snapshot: {
      lines: row.lines.map((l) => ({ name: l.name, amount: l.amount })),
      itemSubtotal: row.itemSubtotal, extra: row.extra, total: row.total,
    },
  }
  persistBill()
  toast.success(`${name} sudah lunas! Struknya tersimpan khusus untukmu 🧾`)
  openReceipt(row.id)
}

async function undoPaid(id) {
  const name = memberById(id)?.name
  if (!(await askConfirm({ title: 'Batalkan status lunas?', message: `${name} akan ditandai belum bayar dan struk lunasnya dihapus.`, okText: 'Batalkan lunas', danger: true }))) return
  delete bill.payments[id]
  receiptView.value = null
  persistBill()
  toast.info(`${name} kembali ditandai belum lunas.`)
}

function openReceipt(id) {
  const payment = bill.payments[id]
  if (!payment) return
  receiptView.value = { billTitle: bill.title || 'Tagihan', billDate: bill.date, ownerName: ownerName.value, member: memberById(id), payment }
}

// ==========================================
// 6. RIWAYAT TAGIHAN
// ==========================================
const savedBills = ref([])

/** rapikan data lama (format sebelum ada mode pembagian / struk lunas) */
function normalizeRecord(r) {
  const rec = { ...r }
  rec.items = (r.items || []).map((it, i) => makeItem(it, i))
  rec.participants = r.participants || []
  rec.discount = Number(r.discount) || 0
  rec.serviceCharge = Number(r.serviceCharge) || 0
  rec.tax = Number(r.tax) || 0
  rec.payments = { ...(r.payments || {}) }
  if (r.paidStatus && !r.payments) {
    const ids = rec.participants.map((p) => p.id)
    const calc = computeSplit({ items: rec.items, memberIds: ids, tax: rec.tax, serviceCharge: rec.serviceCharge, discount: rec.discount })
    for (const [id, paid] of Object.entries(r.paidStatus)) {
      const row = calc.rows.find((x) => x.id === id)
      if (!paid || id === 'me' || !row) continue
      rec.payments[id] = {
        paid: true, paidAt: new Date(`${r.date || new Date().toISOString().slice(0, 10)}T12:00:00`).toISOString(), receiptNo: makeReceiptNo(),
        snapshot: { lines: row.lines.map((l) => ({ name: l.name, amount: l.amount })), itemSubtotal: row.itemSubtotal, extra: row.extra, total: row.total },
      }
    }
  }
  return rec
}

function loadSavedBills() {
  savedBills.value = read(KEY_BILLS, []).map(normalizeRecord)
}

function billStats(rec) {
  const ids = rec.participants.map((p) => p.id)
  const calc = computeSplit({ items: rec.items, memberIds: ids, tax: rec.tax, serviceCharge: rec.serviceCharge, discount: rec.discount })
  const others = calc.rows.filter((r) => r.id !== 'me')
  const unpaid = others.filter((r) => !rec.payments[r.id]?.paid)
  return {
    total: ids.length ? rec.grandTotal : 0,
    people: ids.length,
    paid: ids.filter((id) => id === 'me' || rec.payments[id]?.paid).length,
    unpaidAmount: unpaid.reduce((a, r) => a + r.total, 0),
    unpaidPeople: unpaid.length,
  }
}
const homeStats = computed(() => {
  let amount = 0, people = 0
  for (const b of savedBills.value) { const s = billStats(b); amount += s.unpaidAmount; people += s.unpaidPeople }
  return { amount, people }
})

function persistBill() {
  if (!currentBillId.value) return
  const rec = {
    id: currentBillId.value,
    title: bill.title.trim() || 'Tagihan ' + formatDate(bill.date),
    date: bill.date,
    subtotal: subtotal.value, tax: Number(bill.tax) || 0, serviceCharge: Number(bill.serviceCharge) || 0,
    discount: Number(bill.discount) || 0, grandTotal: grandTotal.value,
    participants: selectedMembers.value.map((p) => ({ ...p })),
    items: JSON.parse(JSON.stringify(bill.items)),
    payments: JSON.parse(JSON.stringify(bill.payments)),
    updatedAt: new Date().toISOString(),
  }
  const i = savedBills.value.findIndex((b) => b.id === rec.id)
  if (i > -1) savedBills.value[i] = rec
  else savedBills.value.unshift(rec)
  write(KEY_BILLS, savedBills.value)
  queueBill({ id: rec.id, updatedAt: rec.updatedAt, data: rec })
}

function openSavedBill(b) {
  const rec = normalizeRecord(b)
  currentBillId.value = rec.id
  Object.assign(bill, { title: rec.title, date: rec.date, tax: rec.tax, serviceCharge: rec.serviceCharge, discount: rec.discount, aiTotal: 0, items: rec.items, payments: rec.payments })
  for (const p of rec.participants) if (!memberById(p.id)) participants.value.push({ ...p })
  selectedMemberIds.value = rec.participants.map((p) => p.id)
  expanded.value = {}
  step.value = 8
}

async function deleteCurrentBill() {
  if (!(await askConfirm({ title: 'Hapus tagihan ini?', message: 'Rincian dan semua struk lunasnya ikut terhapus. Tidak bisa dikembalikan.', okText: 'Hapus', danger: true }))) return
  const delId = currentBillId.value
  savedBills.value = savedBills.value.filter((b) => b.id !== delId)
  write(KEY_BILLS, savedBills.value)
  queueBill({ id: delId, updatedAt: new Date().toISOString(), deleted: true })
  toast.info('Tagihan dihapus.')
  step.value = 0
}

function startNewBill() {
  currentBillId.value = 'bill_' + Date.now()
  Object.assign(bill, { title: '', date: new Date().toISOString().slice(0, 10), tax: 0, serviceCharge: 0, discount: 0, aiTotal: 0, items: [], payments: {} })
  selectedMemberIds.value = ['me', ...selectedMemberIds.value.filter((id) => id !== 'me')]
  clearPhoto()
  step.value = 1
}

// ==========================================
// 7. METODE PEMBAYARAN (BANK / E-WALLET / QRIS)
// ==========================================
const paymentMethods = ref([])
const qrisFileInput = ref(null)
const qrisCamInput = ref(null)
const readingQris = ref(false)
const newPayment = reactive({ category: 'BANK', provider: 'BCA', accountNumber: '', accountName: '' })

const hasQris = computed(() => paymentMethods.value.some((m) => m.category === 'QRIS' && m.qrisPayload))
const savePaymentMethods = () => { write(KEY_PAYMENTS, paymentMethods.value); queueProfile() }

function addPaymentMethod() {
  if (!newPayment.provider.trim()) return toast.info('Isi nama bank / e-wallet-nya dulu ya.')
  if (!newPayment.accountNumber.trim() || !newPayment.accountName.trim()) return toast.info('Isi nomor rekening/HP dan atas nama dulu ya.')
  paymentMethods.value.push({
    id: 'pay_' + Date.now(), category: newPayment.category, provider: newPayment.provider.trim(),
    accountNumber: newPayment.accountNumber.trim(), accountName: newPayment.accountName.trim(), qrisPayload: '',
  })
  savePaymentMethods()
  toast.success(`${newPayment.provider.trim()} tersimpan ✅`)
  newPayment.accountNumber = ''
  newPayment.accountName = ''
}

async function removePaymentMethod(m) {
  if (!(await askConfirm({ title: 'Hapus metode ini?', message: `${m.provider} tidak akan muncul lagi di pesan tagihan.`, okText: 'Hapus', danger: true }))) return
  paymentMethods.value = paymentMethods.value.filter((x) => x.id !== m.id)
  savePaymentMethods()
  toast.info('Metode pembayaran dihapus.')
}

/** Baca QRIS dari foto / screenshot. Semua pesan lewat toast di dalam aplikasi. */
async function handleQrisImage(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  readingQris.value = true
  try {
    const text = await decodeQrFromFile(file)
    if (!text) return toast.error('QR tidak terbaca. Coba foto lebih dekat & terang, atau pakai screenshot QRIS aslinya.')
    if (!text.startsWith('000201')) return toast.error('QR ini bukan QRIS. Pastikan yang difoto adalah QRIS toko/pribadimu.')
    if (!isValidQris(text)) return toast.error('QRIS terbaca tapi kodenya rusak (CRC tidak cocok). Coba foto ulang yang lebih jelas.')
    if (paymentMethods.value.some((m) => m.qrisPayload === text)) return toast.info('QRIS ini sudah tersimpan.')
    const name = merchantName(text) || 'QRIS Saya'
    paymentMethods.value.push({
      id: 'pay_' + Date.now(), category: 'QRIS', provider: `QRIS (${name})`,
      accountNumber: merchantNmid(text) || 'QRIS Standar', accountName: name, qrisPayload: text,
    })
    savePaymentMethods()
    toast.success(`QRIS "${name}" tersimpan dan siap dipakai ✅`)
  } catch (err) {
    toast.error('Gagal memproses gambar QRIS. Coba gambar lain.')
  } finally {
    readingQris.value = false
  }
}

async function copyText(str) {
  try { await navigator.clipboard.writeText(str); toast.success('Berhasil disalin 📋') }
  catch { toast.error('Tidak bisa menyalin otomatis. Tekan lama untuk menyalin manual.') }
}

// ==========================================
// 8. KAMERA & SCAN AI
// ==========================================
function clearPhoto() {
  if (receiptPhotoUrl.value) URL.revokeObjectURL(receiptPhotoUrl.value)
  receiptPhotoUrl.value = ''
  selectedFile.value = null
  scanError.value = ''
}

function onPhotoFile(file) {
  clearPhoto()
  selectedFile.value = file
  receiptPhotoUrl.value = URL.createObjectURL(file)
  step.value = 3
}

function startManual() {
  clearPhoto()
  step.value = 5
}

function cancelScan() {
  scanAbort?.abort()
  step.value = 3
}

async function runAiScan() {
  if (!selectedFile.value) { step.value = 2; return }
  step.value = 4
  scanError.value = ''
  scanAbort = new AbortController()
  const timer = setTimeout(() => scanAbort.abort('timeout'), 60000)
  try {
    const prepared = await prepareReceiptImage(selectedFile.value)
    const fd = new FormData()
    fd.append('file', prepared)
    const res = await fetch(`${API_URL}/receipts/ai-scan`, { method: 'POST', body: fd, signal: scanAbort.signal })
    if (!res.ok) {
      let msg = `Server membalas ${res.status}`
      try { const j = await res.json(); if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message } catch { /* abaikan */ }
      throw new Error(msg)
    }
    const data = await res.json()
    const lines = (data.lines || []).filter((l) => l && (l.name || l.price))
    if (!lines.length) throw new Error('Tidak ada menu yang terbaca dari foto ini.')

    bill.title = data.merchant || 'Struk Belanja'
    bill.date = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : new Date().toISOString().slice(0, 10)
    bill.tax = Number(data.tax) || 0
    bill.serviceCharge = Number(data.service) || 0
    bill.discount = 0
    bill.items = lines.map((l, i) => makeItem({ id: i + 1, name: l.name, qty: l.qty, price: l.price, touched: false }, i))
    bill.aiTotal = Number(data.total) || 0
    step.value = 5
    toast.success(`${bill.items.length} menu berhasil dibaca 🎉 Cek dulu ya sebelum lanjut.`)
  } catch (err) {
    if (scanAbort?.signal.aborted && scanAbort.signal.reason !== 'timeout') return // dibatalkan pengguna
    scanError.value = scanAbort?.signal.reason === 'timeout'
      ? 'AI kelamaan membalas. Coba lagi sebentar, atau isi manual.'
      : /fetch|network|failed/i.test(err.message)
        ? 'Tidak bisa menghubungi server AI. Pastikan server API menyala.'
        : err.message
    toast.error('Struk belum bisa dibaca. ' + scanError.value)
    step.value = 3
  } finally {
    clearTimeout(timer)
  }
}

// ==========================================
// 9. PEMBAGIAN PER MENU / PER ORANG
// ==========================================
const touch = (item) => { item.touched = true }

/** Item yang belum pernah diatur otomatis dibagi ke semua anggota terpilih saat masuk step 7. */
function ensureDefaultAssignments() {
  bill.items.forEach((it) => {
    if (!it.touched && it.splitMode === 'equal') it.assignedTo = [...memberIds.value]
  })
}

function goSplit() {
  if (memberIds.value.length < 2) return toast.info('Pilih minimal 1 teman untuk diajak patungan.')
  ensureDefaultAssignments()
  step.value = 7
}

function splitAllEqually() {
  bill.items.forEach((it) => { it.splitMode = 'equal'; it.assignedTo = [...memberIds.value]; it.weights = {}; it.touched = true })
  toast.success('Semua menu dibagi rata ke semua anggota.')
}

const memberLabelOf = (id) => memberById(id)?.name || '?'
const isIn = (item, id) => itemWeights(item, memberIds.value)[memberIds.value.indexOf(id)] > 0
const modeLabel = (item) => SPLIT_MODES.find((m) => m.value === item.splitMode)?.label

function syncAssigned(item) {
  item.assignedTo = memberIds.value.filter((id) => (Number(item.weights[id]) || 0) > 0)
}

function setMode(item, mode) {
  if (item.splitMode === mode) return
  const ids = memberIds.value
  let cur = itemShares(item, ids)
  if (!Object.values(cur).some((v) => v > 0)) ids.forEach((id) => (cur[id] = 1)) // belum ada yang dipilih → semua
  const price = Math.round(Number(item.price) || 0)
  const w = {}
  if (mode === 'shares') {
    // pertahankan rasio (mis. 50/25/25 -> 2/1/1); kalau rasionya tidak rapi, jatuh ke 1 porsi per orang
    const vals = ids.map((id) => cur[id]).filter((v) => v > 0)
    const g = vals.reduce((a, b) => { while (b) [a, b] = [b, a % b]; return a }, 0) || 1
    const ratio = vals.map((v) => v / g)
    const ok = ratio.every(Number.isInteger) && Math.max(...ratio) <= 20
    ids.forEach((id) => { w[id] = cur[id] > 0 ? (ok ? cur[id] / g : 1) : 0 })
  }
  else if (mode === 'percent') { const p = distribute(100, ids.map((id) => cur[id])); ids.forEach((id, i) => { w[id] = p[i] }) }
  else if (mode === 'amount') {
    const a = Object.values(cur).reduce((x, y) => x + y, 0) === price ? cur : Object.fromEntries(ids.map((id, i) => [id, distribute(price, ids.map((x) => (cur[x] > 0 ? 1 : 0)))[i]]))
    ids.forEach((id) => { w[id] = a[id] })
  }
  const keep = ids.filter((id) => cur[id] > 0)
  item.splitMode = mode
  if (mode === 'equal') { item.assignedTo = keep; item.weights = {} }
  else { item.weights = w; syncAssigned(item) }
  touch(item)
}

function toggleOnItem(item, id) {
  touch(item)
  if (item.splitMode === 'equal') {
    const i = item.assignedTo.indexOf(id)
    if (i > -1) item.assignedTo.splice(i, 1)
    else item.assignedTo.push(id)
  } else {
    item.weights[id] = isIn(item, id) ? 0 : (item.splitMode === 'shares' ? 1 : 0)
    syncAssigned(item)
  }
}

function toggleAllOnItem(item) {
  touch(item)
  item.splitMode = 'equal'
  item.weights = {}
  item.assignedTo = item.assignedTo.length ? [] : [...memberIds.value]
}

function setWeight(item, id, value) {
  const v = Math.max(0, Math.round(Number(value) || 0))
  item.weights[id] = v
  syncAssigned(item)
  touch(item)
}
const stepShare = (item, id, d) => setWeight(item, id, (Number(item.weights[id]) || 0) + d)

function fillRemainder(item, id) {
  const bal = modeBalance(item, memberIds.value)
  if (!bal) return
  setWeight(item, id, (Number(item.weights[id]) || 0) + bal.diff)
}

const modalShares = computed(() => (activeModalItem.value ? itemShares(activeModalItem.value, memberIds.value) : {}))
const modalBalance = computed(() => (activeModalItem.value ? modeBalance(activeModalItem.value, memberIds.value) : null))

async function sendToMembers() {
  const n = split.value.unassigned.length
  if (n > 0 && !(await askConfirm({ title: `${n} menu belum dibagi`, message: 'Menu itu tidak masuk ke tagihan siapa pun. Tetap lanjut?', okText: 'Tetap lanjut' }))) return
  persistBill()
  expanded.value = {}
  step.value = 8
}

function finish() {
  persistBill()
  step.value = 0
  toast.success('Tagihan tersimpan 🍰')
}

// ==========================================
// 10. QRIS NOMINAL PAS & WHATSAPP
// ==========================================
function showQrisForPerson(row) {
  const m = paymentMethods.value.find((x) => x.category === 'QRIS' && x.qrisPayload)
  if (!m) {
    toast.info('Belum ada QRIS tersimpan. Upload QRIS-mu dulu di sini ya.')
    showPaymentModal.value = true
    return
  }
  try {
    const payload = toDynamicQris(m.qrisPayload, row.total)
    activeQrisModal.value = { name: row.member.name, amount: row.total, merchant: m.accountName, nmid: merchantNmid(m.qrisPayload), payload }
  } catch (e) {
    toast.error('QRIS tidak bisa dibuat: ' + e.message)
  }
}

watch(activeQrisModal, async (v) => {
  if (!v) return
  await nextTick()
  try { await drawQr(qrCanvas.value, v.payload, 320) } catch { toast.error('Gagal menggambar QR.') }
})

async function downloadQrisImage(q) {
  try {
    const a = document.createElement('a')
    a.href = await qrToDataUrl(q.payload, 1024)
    a.download = `QRIS-${q.name}-Rp${Math.round(q.amount)}.png`
    a.click()
    toast.success('QRIS diunduh. Buka dari galeri untuk di-scan 📥')
  } catch { toast.error('Gagal mengunduh QRIS.') }
}

function sendWhatsApp(row) {
  const pay = paymentMethods.value.map((m) => {
    if (m.category === 'BANK') return `• Transfer ${m.provider}: *${m.accountNumber}* (a.n. ${m.accountName})`
    if (m.category === 'EWALLET') return `• ${m.provider}: *${m.accountNumber}* (a.n. ${m.accountName})`
    return `• QRIS ${m.accountName}: QR nominal pas kukirim terpisah`
  }).join('\n')
  const lines = row.lines.map((l) => `• ${l.name}: ${formatRupiah(l.amount)}`).join('\n')
  const msg =
    `Hai ${row.member.name}! 🍰\n` +
    `Ini rincian bagianmu di "${bill.title || 'tagihan kita'}" (${formatDate(bill.date)}):\n` +
    `${lines}\n` +
    `• Pajak, service & lainnya: ${formatRupiah(row.extra)}\n` +
    `👉 Total: *${formatRupiah(row.total)}*\n\n` +
    (pay ? `Bisa bayar lewat:\n${pay}\n\n` : '') +
    `Kalau sudah bayar kabari yaa, makasih! ✨\n— ${ownerName.value}`
  const num = waNumber(row.member.wa)
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
}

// ==========================================
// 12. SINKRON KE AKUN (hanya aktif saat login)
// ==========================================
// Tagihan, metode pembayaran, dan daftar teman tetap disimpan di HP (jalan tanpa internet),
// lalu disalin ke akun supaya muncul di semua perangkat. Aturan gabung: yang waktu ubahnya
// lebih baru menang; tagihan yang dihapus ditandai (bukan hilang diam-diam) supaya tidak muncul lagi.
const KEY_SYNC_OWNER = 'tagihanku_sync_owner' // id akun yang datanya ada di HP ini
const KEY_PROFILE_AT = 'tagihanku_profile_updated_at'
const accountId = () => auth.user?.id || ''
const ts = (v) => { const n = Date.parse(v); return Number.isFinite(n) ? n : 0 }
const dropKey = (k) => { try { localStorage.removeItem(k) } catch { /* mode privat */ } }
let syncing = false
let pending = new Map() // id -> { id, updatedAt, data | deleted }
let billTimer = null
let profileTimer = null

async function flushBills() {
  billTimer = null
  if (!accountId() || !pending.size) return
  const batch = [...pending.values()]
  pending = new Map()
  try {
    for (let i = 0; i < batch.length; i += 10) await syncApi.pushBills(batch.slice(i, i + 10))
  } catch { /* offline: rekaman lokal lebih baru, otomatis dikirim saat sinkron berikutnya */ }
}

function queueBill(entry) {
  if (!accountId()) return
  pending.set(entry.id, entry)
  clearTimeout(billTimer)
  billTimer = setTimeout(flushBills, 800)
}

function queueProfile() {
  const at = new Date().toISOString()
  try { localStorage.setItem(KEY_PROFILE_AT, at) } catch { /* mode privat */ }
  if (!accountId()) return
  clearTimeout(profileTimer)
  profileTimer = setTimeout(async () => {
    try {
      await syncApi.pushProfile({
        updatedAt: at,
        paymentMethods: paymentMethods.value,
        friends: participants.value.map(({ paid, ...p }) => p),
      })
    } catch { /* dicoba lagi saat sinkron berikutnya */ }
  }, 800)
}

async function syncFromServer() {
  const uid = accountId()
  if (!uid || syncing) return
  syncing = true
  try {
    let prevOwner = ''
    try { prevOwner = localStorage.getItem(KEY_SYNC_OWNER) || '' } catch { /* mode privat */ }
    if (prevOwner && prevOwner !== uid) {
      // HP ini sebelumnya dipakai akun lain: jangan campur datanya ke akun ini
      for (const k of [KEY_BILLS, KEY_PAYMENTS, KEY_FRIENDS, KEY_PROFILE_AT]) dropKey(k)
      savedBills.value = []
      paymentMethods.value = []
      participants.value = [{ ...OWNER }]
      selectedMemberIds.value = ['me']
    }
    const remote = await syncApi.pull()

    // ---- tagihan
    const merged = new Map(savedBills.value.map((b) => [b.id, b]))
    const remoteById = new Map(remote.bills.map((r) => [r.id, r]))
    for (const r of remote.bills) {
      const l = merged.get(r.id)
      if (l && ts(l.updatedAt) > ts(r.updatedAt)) continue // lokal lebih baru → dikirim ke server di bawah
      if (r.deleted) merged.delete(r.id)
      else merged.set(r.id, { ...r.data, id: r.id, updatedAt: r.updatedAt })
    }
    for (const [id, rec] of merged) {
      const r = remoteById.get(id)
      if (r && ts(rec.updatedAt) <= ts(r.updatedAt)) continue
      rec.updatedAt = rec.updatedAt || new Date().toISOString()
      pending.set(id, { id, updatedAt: rec.updatedAt, data: rec })
    }
    savedBills.value = [...merged.values()].map(normalizeRecord).sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
    write(KEY_BILLS, savedBills.value)

    // ---- metode pembayaran & daftar teman
    let localAt = 0
    try { localAt = ts(localStorage.getItem(KEY_PROFILE_AT) || '') } catch { /* mode privat */ }
    const rp = remote.profile
    if (rp && ts(rp.updatedAt) >= localAt) {
      paymentMethods.value = rp.paymentMethods
      write(KEY_PAYMENTS, paymentMethods.value)
      if (rp.friends.length) {
        participants.value = rp.friends.map(({ paid, ...p }) => p)
        if (!participants.value.some((p) => p.isOwner)) participants.value.unshift({ ...OWNER })
        selectedMemberIds.value = participants.value.map((p) => p.id)
        write(KEY_FRIENDS, participants.value)
      }
      try { localStorage.setItem(KEY_PROFILE_AT, rp.updatedAt) } catch { /* mode privat */ }
    } else if (localAt > 0 || paymentMethods.value.length) {
      queueProfile() // data di HP lebih baru / akun masih kosong → kirim ke akun
    }

    try { localStorage.setItem(KEY_SYNC_OWNER, uid) } catch { /* mode privat */ }
    if (pending.size) flushBills()
    adoptAccountName()
  } catch { /* offline / server belum siap: tetap pakai data di HP */ } finally {
    syncing = false
  }
}

// akun baru selesai dimuat (login / pulihkan sesi) setelah halaman terbuka
watch(() => auth.user?.id, (id) => { if (id) syncFromServer() })

// Nama pembuat masih bawaan "Kamu" → pakai nama akun begitu sudah login.
// Dipisah dari sinkron supaya tetap jalan walau server sinkron belum siap / offline.
function adoptAccountName() {
  const o = participants.value.find((p) => p.isOwner)
  if (o && o.name === 'Kamu' && auth.user?.name) ownerName.value = auth.user.name
}
watch([() => auth.user?.name, () => participants.value.find((p) => p.isOwner)?.name], adoptAccountName, { immediate: true })

// ==========================================
// 11. PENGENALAN & MULAI
// ==========================================
function finishWelcome() {
  showWelcome.value = false
  try { localStorage.setItem(KEY_WELCOME, '1') } catch { /* mode privat */ }
}
function replayIntro() {
  showTheme.value = false
  showWelcome.value = true
}

const SAMPLE_NUMBERS = new Set(['1234567890', '081234567890'])

onMounted(() => {
  loadSavedBills()

  paymentMethods.value = read(KEY_PAYMENTS, [])
    // buang rekening contoh lama (nomor palsu) supaya tidak ikut terkirim ke teman
    .filter((m) => !(['1', '2'].includes(m.id) && SAMPLE_NUMBERS.has(m.accountNumber)))

  const saved = read(KEY_FRIENDS, null)
  participants.value = Array.isArray(saved) && saved.length ? saved.map(({ paid, ...p }) => p) : [{ ...OWNER }]
  if (!participants.value.some((p) => p.isOwner)) participants.value.unshift({ ...OWNER })
  selectedMemberIds.value = participants.value.map((p) => p.id)

  let seen = false
  try { seen = localStorage.getItem(KEY_WELCOME) === '1' } catch { /* mode privat */ }
  showWelcome.value = SHOW_WELCOME_EVERY_VISIT || !seen

  if (auth.user?.id) syncFromServer()
})

onBeforeUnmount(() => { clearPhoto(); scanAbort?.abort() })
</script>

<template>
  <div class="mx-auto min-h-[100dvh] max-w-md bg-page text-ink font-sans relative antialiased shadow-2xl">

    <!-- ======================================================== -->
    <!-- PENGENALAN                                               -->
    <!-- ======================================================== -->
    <WelcomeIntro v-if="showWelcome" @done="finishWelcome" />

    <!-- ======================================================== -->
    <!-- STEP 0: BERANDA / RIWAYAT                                -->
    <!-- ======================================================== -->
    <section v-if="step === 0" class="min-h-[100dvh] flex flex-col">
      <main class="flex-1 p-4 space-y-4 pb-6">
        <header class="flex items-center justify-between pt-1">
          <div class="flex items-center gap-2.5">
            <CatMascot :size="46" mood="happy" />
            <div>
              <h1 class="font-display font-bold text-2xl text-ink leading-none">Tagihanku</h1>
              <p class="text-[11px] text-muted font-bold mt-0.5">{{ auth.loggedIn ? 'Tersimpan di akunmu' : 'Split bill santai, tanpa login' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="circle-btn" aria-label="Ubah tema" @click="showTheme = true">🎨</button>
            <button class="circle-btn" aria-label="Rekening dan QRIS" @click="showPaymentModal = true">💳</button>
            <button class="circle-btn" :aria-label="auth.loggedIn ? 'Pengaturan akun' : 'Masuk atau daftar'" @click="goAccount">{{ auth.loggedIn ? '⚙️' : '👤' }}</button>
          </div>
        </header>

        <!-- kartu ringkasan -->
        <div class="relative overflow-hidden rounded-3xl border-2 border-edge shadow-sticker bg-hero text-hero-ink p-4 pr-28 min-h-[132px]">
          <p class="text-[11px] font-extrabold uppercase tracking-widest opacity-80">Halo, {{ ownerName }}!</p>
          <template v-if="homeStats.people > 0">
            <p class="font-display font-bold text-3xl leading-tight mt-1">{{ formatRupiah(homeStats.amount) }}</p>
            <p class="text-xs font-semibold opacity-90 leading-snug">masih ditunggu dari {{ homeStats.people }} orang</p>
          </template>
          <template v-else>
            <p class="font-display font-bold text-2xl leading-tight mt-1">{{ savedBills.length ? 'Semua aman 🎉' : 'Yuk mulai!' }}</p>
            <p class="text-xs font-semibold opacity-90 leading-snug">{{ savedBills.length ? 'Tidak ada tagihan yang menunggu.' : 'Bikin split bill pertamamu, gampang kok.' }}</p>
          </template>
          <div class="absolute -right-2 -bottom-3 animate-bob"><CatMascot :size="104" mood="happy" bare /></div>
          <span class="absolute top-3 right-4 text-xl">🍞</span>
        </div>

        <!-- riwayat -->
        <div class="space-y-3">
          <h3 class="text-[11px] font-extrabold uppercase text-muted tracking-wider">Riwayat tagihan ({{ savedBills.length }})</h3>

          <div v-if="savedBills.length === 0" class="gingham card p-8 text-center space-y-2">
            <span class="text-4xl block">🧾</span>
            <p class="font-extrabold text-sm text-ink">Belum ada tagihan tersimpan</p>
            <p class="text-xs text-muted font-semibold">Tekan tombol di bawah untuk bikin yang pertama.</p>
          </div>

          <div v-else class="space-y-2.5">
            <button
              v-for="sb in savedBills" :key="sb.id" type="button"
              class="card w-full text-left p-4 space-y-2.5 active:translate-y-[2px] active:shadow-none transition"
              @click="openSavedBill(sb)"
            >
              <div class="flex items-center justify-between gap-2">
                <h4 class="font-extrabold text-sm text-ink truncate">{{ sb.title }}</h4>
                <span class="font-black text-xs text-brand-ink bg-brand-soft rounded-full px-2.5 py-0.5 whitespace-nowrap">{{ formatRupiah(sb.grandTotal) }}</span>
              </div>
              <div class="h-2 rounded-full bg-line overflow-hidden">
                <div class="h-full bg-ok transition-all" :style="{ width: `${(billStats(sb).paid / Math.max(1, billStats(sb).people)) * 100}%` }" />
              </div>
              <div class="flex items-center justify-between text-[11px] font-bold text-muted">
                <span>{{ formatDate(sb.date) }} · {{ sb.participants.length }} orang</span>
                <span v-if="billStats(sb).unpaidPeople === 0" class="chip bg-ok-soft text-ok-ink">✓ Lunas semua</span>
                <span v-else class="chip bg-warn-soft text-warn-ink">{{ billStats(sb).unpaidPeople }} belum bayar</span>
              </div>
            </button>
          </div>
        </div>
      </main>

      <footer class="sticky bottom-0 p-4 bg-gradient-to-t from-page via-page/95 to-transparent">
        <button class="btn-primary w-full py-4 text-base" @click="startNewBill"><span class="text-xl leading-none">+</span> Buat split bill baru</button>
      </footer>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 1: PILIH CARA                                       -->
    <!-- ======================================================== -->
    <section v-else-if="step === 1" class="min-h-[100dvh] flex flex-col justify-between bg-hero p-4">
      <div class="flex justify-end pt-2">
        <button class="w-9 h-9 rounded-full bg-white/20 text-white font-bold" aria-label="Tutup" @click="step = 0">✕</button>
      </div>
      <div class="text-center text-hero-ink space-y-2 pb-4">
        <div class="animate-bob inline-block"><CatMascot :size="104" mood="happy" /></div>
        <p class="text-xs font-extrabold uppercase tracking-[.25em] opacity-80">Tagihan baru</p>
      </div>

      <div class="bg-page rounded-3xl border-2 border-edge shadow-sticker p-6 space-y-4 animate-slide-up">
        <h2 class="font-display font-bold text-2xl text-ink leading-tight">Pilih cara yang kamu mau</h2>
        <div class="space-y-3">
          <button type="button" class="card w-full flex items-center gap-4 p-4 text-left active:translate-y-[2px] active:shadow-none transition" @click="step = 2">
            <div class="w-12 h-12 rounded-2xl bg-brand-soft text-2xl flex items-center justify-center border-2 border-edge/70">📷</div>
            <div class="flex-1">
              <h3 class="font-extrabold text-sm text-ink">Hitung otomatis pakai struk</h3>
              <p class="text-xs text-muted font-semibold mt-0.5">Foto struk, AI yang baca menu & harganya.</p>
            </div>
            <span class="text-muted font-bold text-lg">›</span>
          </button>
          <button type="button" class="card w-full flex items-center gap-4 p-4 text-left active:translate-y-[2px] active:shadow-none transition" @click="startManual">
            <div class="w-12 h-12 rounded-2xl bg-sun-soft text-2xl flex items-center justify-center border-2 border-edge/70">✍️</div>
            <div class="flex-1">
              <h3 class="font-extrabold text-sm text-ink">Isi menu sendiri</h3>
              <p class="text-xs text-muted font-semibold mt-0.5">Ketik menu & harga tanpa foto struk.</p>
            </div>
            <span class="text-muted font-bold text-lg">›</span>
          </button>
        </div>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 2: KAMERA LANGSUNG                                  -->
    <!-- ======================================================== -->
    <CameraCapture v-else-if="step === 2" @capture="onPhotoFile" @close="step = 1" />

    <!-- ======================================================== -->
    <!-- STEP 3: PREVIEW FOTO                                     -->
    <!-- ======================================================== -->
    <section v-else-if="step === 3" class="min-h-[100dvh] flex flex-col">
      <main class="flex-1 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <button class="circle-btn" aria-label="Kembali" @click="step = 2">←</button>
          <span class="font-extrabold text-sm text-ink">Foto struk</span>
          <span class="w-9" />
        </div>

        <p v-if="scanError" class="card bg-accent-soft text-accent text-xs font-extrabold leading-snug p-3">⚠️ {{ scanError }}</p>

        <div class="card p-3 flex items-center justify-center">
          <img :src="receiptPhotoUrl" class="max-h-[58vh] w-auto object-contain rounded-xl" alt="Foto struk" />
        </div>
        <p class="text-[11px] text-muted font-semibold text-center">Pastikan semua tulisan terbaca jelas, lalu lanjut.</p>
      </main>

      <footer class="sticky bottom-0 p-4 space-y-2 bg-gradient-to-t from-page via-page/95 to-transparent">
        <button class="btn-primary w-full py-4 text-base" @click="runAiScan">{{ scanError ? 'Coba baca lagi' : 'Pakai foto ini' }}</button>
        <div class="flex gap-2">
          <button class="btn-soft flex-1 py-3 text-xs" @click="step = 2">📷 Foto ulang</button>
          <button class="btn-soft flex-1 py-3 text-xs" @click="startManual">✍️ Isi manual</button>
        </div>
      </footer>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 4: AI MEMBACA STRUK                                 -->
    <!-- ======================================================== -->
    <section v-else-if="step === 4" class="min-h-[100dvh] flex flex-col justify-between p-6 bg-brand text-on-brand relative">
      <div><button class="w-9 h-9 rounded-full bg-white/20 font-bold" aria-label="Batalkan" @click="cancelScan">←</button></div>
      <div class="relative mx-auto w-64 h-80 bg-surface rounded-3xl p-2.5 shadow-2xl overflow-hidden border-2 border-edge">
        <img :src="receiptPhotoUrl" class="w-full h-full object-cover opacity-80 rounded-2xl" alt="" />
        <div class="animate-laser" />
      </div>
      <div class="space-y-3 pb-8 text-center">
        <h3 class="font-display font-bold text-3xl">Membaca struk…</h3>
        <p class="text-xs font-semibold opacity-90">AI sedang mengambil menu, harga, dan pajak</p>
        <div class="w-48 h-2 bg-white/30 rounded-full mx-auto overflow-hidden"><div class="h-full bg-white rounded-full animate-progress" /></div>
      </div>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 5: REVIEW & EDIT MENU                               -->
    <!-- ======================================================== -->
    <section v-else-if="step === 5" class="min-h-[100dvh] flex flex-col">
      <main class="flex-1 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <button class="circle-btn" aria-label="Kembali" @click="step = receiptPhotoUrl ? 3 : 1">←</button>
          <span class="font-extrabold text-sm text-ink">Cek menu & harga</span>
          <span class="w-9" />
        </div>

        <div class="card p-4">
          <label class="text-[11px] font-extrabold text-muted uppercase tracking-wider block">Nama split bill</label>
          <input v-model="bill.title" placeholder="Nama restoran / tagihan" class="w-full text-xl font-display font-bold text-ink bg-transparent outline-none mt-1 border-b-2 border-transparent focus:border-brand" />
        </div>

        <div v-if="receiptPhotoUrl" class="card p-3 flex items-center gap-3">
          <img :src="receiptPhotoUrl" class="w-12 h-12 rounded-xl object-cover border border-line" alt="" />
          <div class="flex-1">
            <h4 class="font-extrabold text-xs text-ink">Struk berhasil dibaca</h4>
            <p class="text-[11px] text-muted font-semibold">Periksa tiap baris di bawah.</p>
          </div>
          <button class="btn-soft px-3 py-2 text-[11px]" @click="step = 2">📷 Ulang</button>
        </div>

        <div class="card p-4 space-y-1">
          <div class="flex justify-between items-center pb-2 border-b border-line">
            <span class="text-xs font-extrabold text-muted">Menu ({{ bill.items.length }})</span>
            <span class="text-xs font-black text-brand-ink">{{ formatRupiah(subtotal) }}</span>
          </div>
          <p v-if="!bill.items.length" class="text-xs text-muted font-semibold text-center py-4">Belum ada menu. Tambahkan di bawah ↓</p>
          <div v-for="it in bill.items" :key="it.id" class="flex items-center gap-2 py-2 border-b border-line last:border-b-0">
            <div class="min-w-0 flex-1">
              <input v-model="it.name" class="font-extrabold text-xs text-ink w-full bg-transparent outline-none" aria-label="Nama menu" />
              <div class="flex items-center gap-1 text-[11px] text-muted font-bold">
                <span>Qty</span>
                <input v-model.number="it.qty" type="number" min="1" class="w-9 bg-transparent font-extrabold outline-none" aria-label="Jumlah" />
              </div>
            </div>
            <input v-model.number="it.price" type="number" min="0" class="font-black text-xs text-ink w-24 text-right bg-page rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-brand/30" aria-label="Harga total baris" />
            <button class="text-accent font-bold text-sm px-1" aria-label="Hapus menu" @click="removeBillItem(it.id)">✕</button>
          </div>
          <p class="text-[10px] text-muted font-semibold pt-1">Harga = total untuk baris itu (sudah dikali jumlah).</p>

          <div class="pt-2 flex gap-1.5 border-t border-line">
            <input v-model="manualItem.name" placeholder="+ Nama menu" class="field flex-1" @keyup.enter="addManualItem" />
            <input v-model.number="manualItem.price" placeholder="Harga" type="number" min="0" class="field !w-24" @keyup.enter="addManualItem" />
            <button class="btn-primary px-3.5 text-sm" aria-label="Tambah menu" @click="addManualItem">+</button>
          </div>
        </div>

        <div class="card p-4 space-y-2 text-xs">
          <div class="flex justify-between items-center"><span class="font-bold text-muted">Pajak (PB1/PPN)</span><input v-model.number="bill.tax" type="number" min="0" class="w-28 text-right font-black bg-page rounded-xl px-2 py-1.5 outline-none" /></div>
          <div class="flex justify-between items-center"><span class="font-bold text-muted">Service charge</span><input v-model.number="bill.serviceCharge" type="number" min="0" class="w-28 text-right font-black bg-page rounded-xl px-2 py-1.5 outline-none" /></div>
          <div class="flex justify-between items-center"><span class="font-bold text-muted">Diskon (−)</span><input v-model.number="bill.discount" type="number" min="0" class="w-28 text-right font-black bg-page rounded-xl px-2 py-1.5 outline-none" /></div>
          <div class="flex justify-between items-center pt-2 border-t border-line font-black text-sm text-ink"><span>Total akhir</span><span>{{ formatRupiah(grandTotal) }}</span></div>
          <div v-if="bill.aiTotal && receiptGap !== 0" class="rounded-2xl bg-warn-soft text-warn-ink p-3 space-y-1.5">
            <p class="font-extrabold leading-snug">Total di struk {{ formatRupiah(bill.aiTotal) }}, selisih {{ formatRupiah(Math.abs(receiptGap)) }} dari hitunganmu.</p>
            <button class="btn-soft px-3 py-1.5 text-[11px]" @click="matchReceiptTotal">Cocokkan dengan struk</button>
          </div>
        </div>
      </main>

      <footer class="sticky bottom-0 p-4 bg-gradient-to-t from-page via-page/95 to-transparent">
        <button class="btn-primary w-full py-4 text-base" @click="bill.items.length ? (step = 6) : toast.info('Tambahkan minimal satu menu dulu ya.')">Konfirmasi</button>
      </footer>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 6: PILIH ANGGOTA                                    -->
    <!-- ======================================================== -->
    <section v-else-if="step === 6" class="min-h-[100dvh] flex flex-col">
      <main class="flex-1 p-4 space-y-3.5">
        <div class="flex items-center justify-between">
          <button class="circle-btn" aria-label="Kembali" @click="step = 5">←</button>
          <div class="text-center">
            <h3 class="font-display font-bold text-lg text-ink leading-none">Pilih anggota</h3>
            <p class="text-[11px] text-muted font-bold mt-1">{{ memberIds.length }} orang ikut</p>
          </div>
          <span class="w-9" />
        </div>

        <div class="card p-4 space-y-3">
          <div class="flex items-center gap-3 pb-3 border-b border-line">
            <div class="w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 border-edge/70" :style="{ backgroundColor: owner.bg }">{{ owner.avatar }}</div>
            <div class="flex-1"><p class="text-[10px] font-extrabold text-muted uppercase tracking-wider">Bayar ke</p><p class="font-extrabold text-sm text-ink">{{ ownerName }} <span class="chip bg-ok-soft text-ok-ink ml-1">Pembuat</span></p></div>
          </div>
          <div class="space-y-1.5">
            <span class="text-[11px] font-extrabold text-muted block">Tambah teman baru</span>
            <div class="flex gap-1.5">
              <input v-model="newFriend.name" placeholder="Nama teman" class="field flex-1" @keyup.enter="addNewFriend" />
              <button class="btn-primary px-4 text-sm" aria-label="Tambah teman" @click="addNewFriend">+</button>
            </div>
            <input v-model="newFriend.wa" inputmode="tel" placeholder="No. WhatsApp (opsional, biar langsung kebuka)" class="field" @keyup.enter="addNewFriend" />
          </div>
        </div>

        <div class="card p-4 space-y-1">
          <h4 class="text-[11px] font-extrabold text-muted uppercase tracking-wider pb-1">Daftar teman</h4>
          <div v-for="person in participants" :key="person.id" class="flex items-center justify-between py-2 border-b border-line last:border-b-0">
            <button type="button" class="flex items-center gap-3 flex-1 text-left" @click="toggleMember(person.id)">
              <span class="w-10 h-10 rounded-full flex items-center justify-center text-base border-2 border-edge/60" :style="{ backgroundColor: person.bg }">{{ person.avatar }}</span>
              <span>
                <span class="font-extrabold text-xs text-ink block">{{ person.name }}</span>
                <span class="text-[11px] text-muted font-semibold block">{{ person.wa ? '📱 ' + person.wa : person.phone }}</span>
              </span>
            </button>
            <div class="flex items-center gap-2">
              <button v-if="!person.isOwner" class="text-muted hover:text-accent text-xs px-1" aria-label="Hapus teman" @click.stop="removeFriend(person.id)">✕</button>
              <button type="button" class="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition"
                :class="selectedMemberIds.includes(person.id) ? 'bg-brand border-edge text-on-brand' : 'border-line bg-surface'"
                :aria-pressed="selectedMemberIds.includes(person.id)" @click="toggleMember(person.id)">
                <span v-if="selectedMemberIds.includes(person.id)" class="text-xs font-black">✓</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer class="sticky bottom-0 p-4 bg-gradient-to-t from-page via-page/95 to-transparent">
        <button class="btn-primary w-full py-4 text-base" @click="goSplit">Konfirmasi anggota</button>
      </footer>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 7: ATUR PEMBAGIAN                                   -->
    <!-- ======================================================== -->
    <section v-else-if="step === 7" class="min-h-[100dvh] flex flex-col">
      <main class="flex-1 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <button class="circle-btn" aria-label="Kembali" @click="step = 6">←</button>
          <h3 class="font-display font-bold text-lg text-ink">Atur pembagian</h3>
          <button class="text-xs font-extrabold text-brand-ink" @click="step = 6">✏️ Anggota</button>
        </div>

        <!-- ringkasan sementara -->
        <div class="card p-3">
          <div class="flex gap-3 overflow-x-auto pb-1">
            <div v-for="r in rows" :key="r.id" class="flex flex-col items-center min-w-[64px] text-center">
              <span class="w-11 h-11 rounded-full border-2 border-edge flex items-center justify-center text-lg" :style="{ backgroundColor: r.member.bg }">{{ r.member.avatar }}</span>
              <span class="text-[10px] font-extrabold text-ink mt-1 truncate max-w-[64px]">{{ r.member.name }}</span>
              <span class="text-[10px] font-black text-brand-ink">{{ formatRupiah(r.total) }}</span>
            </div>
          </div>
        </div>

        <!-- tab -->
        <div class="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-line/60 border border-line">
          <button v-for="t in [{ v: 'menu', l: '🍽️ Per menu' }, { v: 'orang', l: '🧍 Per orang' }]" :key="t.v" type="button"
            class="py-2 rounded-xl text-xs font-extrabold transition"
            :class="splitTab === t.v ? 'bg-surface text-ink shadow-sticker-sm border-2 border-edge' : 'text-muted border-2 border-transparent'"
            @click="splitTab = t.v">{{ t.l }}</button>
        </div>

        <button class="btn-soft w-full py-2.5 text-xs" @click="splitAllEqually">🔱 Bagi rata semuanya</button>

        <p v-if="split.unassigned.length" class="rounded-2xl bg-warn-soft text-warn-ink text-[11px] font-extrabold p-3 leading-snug">
          ⚠️ {{ split.unassigned.length }} menu belum dipilih siapa pun, jadi belum masuk ke tagihan.
        </p>

        <!-- PER MENU -->
        <div v-if="splitTab === 'menu'" class="space-y-2.5">
          <div v-for="item in bill.items" :key="item.id" class="card p-3.5 space-y-2" :class="itemMembers(item, memberIds).length ? '' : 'opacity-90'">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h4 class="font-extrabold text-xs text-ink uppercase truncate">{{ item.name }}</h4>
                <div class="flex items-center gap-2 mt-0.5 text-xs">
                  <span class="text-muted font-bold">x{{ item.qty }}</span>
                  <span class="font-extrabold text-ink">{{ formatRupiah(item.price) }}</span>
                  <span v-if="item.splitMode !== 'equal'" class="chip bg-sun-soft text-ink">{{ modeLabel(item) }}</span>
                </div>
              </div>
              <button type="button" class="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0" aria-label="Pilih semua / kosongkan"
                :class="itemMembers(item, memberIds).length ? 'bg-brand border-edge text-on-brand' : 'border-line bg-surface'" @click="toggleAllOnItem(item)">
                <span v-if="itemMembers(item, memberIds).length" class="text-xs font-black">✓</span>
              </button>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-line">
              <div class="flex items-center -space-x-1.5 min-h-[20px]">
                <span v-for="mid in itemMembers(item, memberIds)" :key="mid" class="w-5 h-5 rounded-full border border-surface flex items-center justify-center text-[9px]" :style="{ backgroundColor: memberById(mid)?.bg }">{{ memberById(mid)?.avatar }}</span>
                <span v-if="!itemMembers(item, memberIds).length" class="text-[10px] text-muted italic font-bold pl-1">Belum dipilih</span>
              </div>
              <button class="text-[11px] font-extrabold text-brand-ink" @click="activeModalItem = item">Atur pembagian ›</button>
            </div>
          </div>
        </div>

        <!-- PER ORANG -->
        <div v-else class="space-y-2.5">
          <div v-for="r in rows" :key="r.id" class="card p-3.5 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="w-9 h-9 rounded-full border-2 border-edge/70 flex items-center justify-center text-base" :style="{ backgroundColor: r.member.bg }">{{ r.member.avatar }}</span>
                <div><p class="font-extrabold text-xs text-ink">{{ r.member.name }}</p><p class="text-[10px] text-muted font-bold">{{ r.lines.length }} menu</p></div>
              </div>
              <span class="font-black text-sm text-brand-ink">{{ formatRupiah(r.total) }}</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="item in bill.items" :key="item.id" type="button"
                class="px-2.5 py-1.5 rounded-xl border-2 text-[11px] font-extrabold transition active:scale-95 max-w-full truncate"
                :class="isIn(item, r.id) ? 'bg-brand text-on-brand border-edge' : 'bg-surface text-muted border-line'"
                @click="item.splitMode === 'equal' ? toggleOnItem(item, r.id) : (activeModalItem = item)">
                {{ isIn(item, r.id) ? '✓ ' : '' }}{{ item.name }}<span v-if="item.splitMode !== 'equal'" class="opacity-80"> · {{ modeLabel(item) }}</span>
              </button>
            </div>
          </div>
          <p class="text-[10px] text-muted font-semibold text-center">Menu bertanda mode khusus (Porsi/Persen/Nominal) dibuka lewat "Atur pembagian".</p>
        </div>
      </main>

      <footer class="sticky bottom-0 p-4 bg-gradient-to-t from-page via-page/95 to-transparent">
        <button class="btn-primary w-full py-4 text-base" @click="sendToMembers">Lanjut ke rincian</button>
      </footer>
    </section>

    <!-- ======================================================== -->
    <!-- STEP 8: RINCIAN, LUNAS, QRIS, WHATSAPP                   -->
    <!-- ======================================================== -->
    <section v-else-if="step === 8" class="min-h-[100dvh] flex flex-col">
      <main class="flex-1 p-4 space-y-3.5">
        <div class="flex items-center justify-between">
          <button class="circle-btn" aria-label="Kembali" @click="step = 7">←</button>
          <h3 class="font-display font-bold text-lg text-ink truncate px-2">{{ bill.title || 'Rincian' }}</h3>
          <button class="text-xs font-extrabold text-brand-ink" @click="finish">Selesai ✓</button>
        </div>

        <div class="card bg-ok-soft p-4 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-xs text-ok-ink">🍰 Status pembayaran</span>
            <span class="text-xs font-black text-ok-ink">{{ paidCount }} dari {{ memberIds.length }} lunas</span>
          </div>
          <div class="w-full bg-surface h-2.5 rounded-full overflow-hidden border border-edge/30">
            <div class="bg-ok h-full transition-all duration-300" :style="{ width: `${(paidCount / Math.max(1, memberIds.length)) * 100}%` }" />
          </div>
          <div class="flex justify-between text-[11px] font-bold text-ok-ink"><span>Total tagihan</span><span>{{ formatRupiah(grandTotal) }}</span></div>
        </div>

        <div class="card p-3 flex items-center justify-between text-xs">
          <span class="font-extrabold text-ink">💳 {{ paymentMethods.length }} metode pembayaran</span>
          <button class="btn-soft px-3 py-1.5 text-[11px]" @click="showPaymentModal = true">Kelola</button>
        </div>

        <div class="space-y-3">
          <div v-for="r in rows" :key="r.id" class="card p-4 space-y-3 transition" :class="isPaid(r.id) && r.id !== 'me' ? 'bg-ok-soft/50' : ''">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-11 h-11 rounded-full border-2 border-edge/70 flex items-center justify-center text-xl shrink-0" :style="{ backgroundColor: r.member.bg }">{{ r.member.avatar }}</span>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <h5 class="font-extrabold text-xs text-ink truncate">{{ r.member.name }}</h5>
                    <span v-if="r.id === 'me'" class="chip bg-brand-soft text-brand-ink">Pembuat</span>
                    <span v-else-if="isPaid(r.id)" class="chip bg-ok text-white">Lunas</span>
                    <span v-else class="chip bg-warn-soft text-warn-ink">Belum</span>
                  </div>
                  <p class="text-[10px] text-muted font-bold">{{ r.lines.length }} menu · {{ formatRupiah(r.itemSubtotal) }}</p>
                  <p class="text-[10px] text-muted/80 font-semibold">+ pajak & service {{ formatRupiah(r.extra) }}</p>
                </div>
              </div>
              <span class="font-black text-sm text-ink whitespace-nowrap">{{ formatRupiah(r.total) }}</span>
            </div>

            <button class="text-[11px] font-extrabold text-brand-ink" @click="expanded[r.id] = !expanded[r.id]">{{ expanded[r.id] ? 'Sembunyikan rincian ▴' : 'Lihat rincian ▾' }}</button>
            <div v-if="expanded[r.id]" class="rounded-2xl bg-page p-3 space-y-1 text-[11px] font-semibold">
              <div v-for="(l, i) in r.lines" :key="i" class="flex justify-between gap-3"><span class="truncate text-ink">{{ l.name }}</span><span class="font-extrabold whitespace-nowrap">{{ formatRupiah(l.amount) }}</span></div>
              <div class="flex justify-between gap-3 pt-1 border-t border-line text-muted"><span>Pajak, service & lainnya</span><span class="font-extrabold">{{ formatRupiah(r.extra) }}</span></div>
            </div>

            <template v-if="r.id !== 'me'">
              <div class="pt-2 border-t border-line flex flex-wrap gap-2">
                <button v-if="!isPaid(r.id)" class="btn-sun flex-1 min-w-[40%] py-2.5 text-xs" @click="markPaid(r)">✓ Sudah lunas</button>
                <button v-else class="btn-soft flex-1 min-w-[40%] py-2.5 text-xs" @click="openReceipt(r.id)">🧾 Lihat struk lunas</button>
                <button v-if="!isPaid(r.id)" class="btn-soft px-3.5 py-2.5 text-xs" @click="showQrisForPerson(r)">🔳 QRIS</button>
                <button class="px-3.5 py-2.5 text-xs btn border-edge bg-[#25D366] text-white" @click="sendWhatsApp(r)">💬 {{ isPaid(r.id) ? 'Kirim ulang' : 'Tagih' }}</button>
              </div>
              <p v-if="isPaid(r.id)" class="text-[10px] font-bold text-muted">🔒 Struk lunas hanya terlihat olehmu, tidak ikut terkirim ke {{ r.member.name }}.</p>
            </template>
          </div>
        </div>

        <button class="w-full text-center text-[11px] font-extrabold text-accent py-2" @click="deleteCurrentBill">🗑 Hapus tagihan ini</button>
      </main>

      <footer class="sticky bottom-0 p-4 flex gap-2 bg-gradient-to-t from-page via-page/95 to-transparent">
        <button class="btn-soft w-1/3 py-3.5 text-xs" @click="step = 7">Ubah</button>
        <button class="btn-primary flex-1 py-3.5 text-sm" @click="finish">Simpan & selesai ✨</button>
      </footer>
    </section>

    <!-- ======================================================== -->
    <!-- STRUK LUNAS (hanya pembuat)                              -->
    <!-- ======================================================== -->
    <PaidReceiptModal v-if="receiptView" :data="receiptView" @close="receiptView = null" @undo="undoPaid(receiptView.member.id)" />

    <!-- TEMA -->
    <ThemeSheet v-if="showTheme" v-model="ownerName" @close="showTheme = false" @replay-intro="replayIntro" />

    <!-- ======================================================== -->
    <!-- MODAL: METODE PEMBAYARAN                                 -->
    <!-- ======================================================== -->
    <div v-if="showPaymentModal" class="fixed inset-0 bg-black/65 z-50 flex items-end sm:items-center justify-center p-3" @click.self="showPaymentModal = false">
      <div class="card w-full max-w-sm p-5 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between pb-2 border-b border-line">
          <div>
            <h4 class="font-display font-bold text-lg text-ink leading-tight">Metode pembayaran</h4>
            <p class="text-[11px] text-muted font-semibold">Ke mana teman-temanmu bisa bayar</p>
          </div>
          <button class="circle-btn" aria-label="Tutup" @click="showPaymentModal = false">✕</button>
        </div>

        <p v-if="!paymentMethods.length" class="text-xs text-muted font-semibold text-center py-2">Belum ada metode pembayaran. Tambahkan di bawah ↓</p>
        <div class="space-y-2">
          <div v-for="m in paymentMethods" :key="m.id" class="p-3 bg-page rounded-2xl flex items-center justify-between gap-2 text-xs border border-line">
            <div class="min-w-0">
              <span class="font-extrabold text-ink flex items-center gap-1.5 flex-wrap">{{ m.provider }}<span v-if="m.category === 'QRIS'" class="chip bg-ok-soft text-ok-ink">QRIS valid</span></span>
              <span class="text-muted font-bold block truncate">{{ m.accountNumber }}</span>
              <span class="text-muted/80 block text-[10px] font-semibold">a.n. {{ m.accountName }}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button v-if="m.category !== 'QRIS'" class="btn-soft px-2.5 py-1 text-[10px]" @click="copyText(m.accountNumber)">Salin</button>
              <button class="text-accent font-bold px-1.5" aria-label="Hapus" @click="removePaymentMethod(m)">✕</button>
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-line space-y-2.5">
          <span class="text-[11px] font-extrabold text-ink block">+ Tambah metode baru</span>
          <div class="grid grid-cols-3 gap-1.5 text-xs font-extrabold">
            <button type="button" class="py-2 rounded-xl border-2 transition" :class="newPayment.category === 'BANK' ? 'bg-ink text-page border-edge' : 'bg-surface text-ink border-line'" @click="newPayment.category = 'BANK'; newPayment.provider = 'BCA'">Bank</button>
            <button type="button" class="py-2 rounded-xl border-2 transition" :class="newPayment.category === 'EWALLET' ? 'bg-ink text-page border-edge' : 'bg-surface text-ink border-line'" @click="newPayment.category = 'EWALLET'; newPayment.provider = 'GoPay'">E-Wallet</button>
            <button type="button" class="py-2 rounded-xl border-2 transition" :class="newPayment.category === 'QRIS' ? 'bg-ink text-page border-edge' : 'bg-surface text-ink border-line'" @click="newPayment.category = 'QRIS'">QRIS</button>
          </div>

          <div v-if="newPayment.category !== 'QRIS'" class="space-y-2">
            <input v-model="newPayment.provider" placeholder="Nama bank / e-wallet (BCA, GoPay, ShopeePay…)" class="field" />
            <input v-model="newPayment.accountNumber" inputmode="numeric" placeholder="Nomor rekening / No. HP" class="field" />
            <input v-model="newPayment.accountName" placeholder="Atas nama" class="field" />
            <button class="btn-primary w-full py-2.5 text-xs" @click="addPaymentMethod">Simpan</button>
          </div>

          <div v-else class="space-y-2 text-center">
            <input ref="qrisFileInput" type="file" accept="image/*" class="hidden" @change="handleQrisImage" />
            <input ref="qrisCamInput" type="file" accept="image/*" capture="environment" class="hidden" @change="handleQrisImage" />
            <div class="grid grid-cols-2 gap-2">
              <button class="btn-primary py-3 text-xs" :disabled="readingQris" @click="qrisFileInput.click()">🖼️ Dari galeri</button>
              <button class="btn-soft py-3 text-xs" :disabled="readingQris" @click="qrisCamInput.click()">📷 Foto QRIS</button>
            </div>
            <p class="text-[10px] text-muted font-semibold leading-relaxed">
              {{ readingQris ? 'Membaca QR…' : 'Pilih gambar / screenshot QRIS toko atau pribadimu. Kode QR dibaca otomatis dan dicek keasliannya (CRC).' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: QRIS NOMINAL PAS                                  -->
    <!-- ======================================================== -->
    <div v-if="activeQrisModal" class="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4" @click.self="activeQrisModal = null">
      <div class="card w-full max-w-xs p-5 text-center space-y-3 animate-slide-up">
        <div class="flex items-start justify-between pb-2 border-b border-line">
          <div class="text-left">
            <span class="chip bg-ok-soft text-ok-ink">Nominal terkunci</span>
            <h4 class="font-extrabold text-sm text-ink mt-1">{{ activeQrisModal.name }}</h4>
          </div>
          <button class="circle-btn" aria-label="Tutup" @click="activeQrisModal = null">✕</button>
        </div>

        <div class="bg-white p-2 rounded-2xl border-2 border-edge mx-auto w-fit">
          <canvas ref="qrCanvas" class="w-56 h-56 block" aria-label="Kode QRIS" />
        </div>

        <div class="space-y-0.5">
          <p class="text-xs text-muted font-bold">{{ activeQrisModal.merchant }}<span v-if="activeQrisModal.nmid"> · {{ activeQrisModal.nmid }}</span></p>
          <p class="font-display font-bold text-3xl text-ink">{{ formatRupiah(activeQrisModal.amount) }}</p>
          <p class="text-[10px] text-muted font-semibold leading-snug pt-1">
            Scan dari GoPay, OVO, ShopeePay, DANA, atau m-banking. Kalau scan dari HP yang sama, unduh dulu lalu pilih dari galeri.
          </p>
        </div>

        <button class="btn-primary w-full py-3 text-xs" @click="downloadQrisImage(activeQrisModal)">📥 Unduh QRIS</button>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- MODAL: ATUR PEMBAGIAN SATU MENU                          -->
    <!-- ======================================================== -->
    <div v-if="activeModalItem" class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-3" @click.self="activeModalItem = null">
      <div class="card w-full max-w-sm p-5 space-y-3.5 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between pb-2 border-b border-line">
          <div class="min-w-0">
            <h4 class="font-extrabold text-xs text-ink uppercase truncate">{{ activeModalItem.name }}</h4>
            <span class="text-sm font-black text-brand-ink">{{ formatRupiah(activeModalItem.price) }}</span>
          </div>
          <button class="circle-btn" aria-label="Tutup" @click="activeModalItem = null">✕</button>
        </div>

        <!-- mode -->
        <div class="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-line/60 border border-line">
          <button v-for="m in SPLIT_MODES" :key="m.value" type="button" class="py-2 rounded-xl text-[11px] font-extrabold transition border-2"
            :class="activeModalItem.splitMode === m.value ? 'bg-surface text-ink border-edge shadow-sticker-sm' : 'text-muted border-transparent'"
            @click="setMode(activeModalItem, m.value)">{{ m.label }}</button>
        </div>
        <p class="text-[11px] text-muted font-semibold leading-snug">
          <template v-if="activeModalItem.splitMode === 'equal'">Pilih siapa saja yang ikut, harga dibagi rata.</template>
          <template v-else-if="activeModalItem.splitMode === 'shares'">Atur jumlah porsi tiap orang (0 = tidak ikut). Contoh: A 2 porsi, B 1 porsi.</template>
          <template v-else-if="activeModalItem.splitMode === 'percent'">Isi persen tiap orang, totalnya 100%.</template>
          <template v-else>Isi nominal tiap orang, totalnya sama dengan harga menu.</template>
        </p>

        <!-- daftar anggota -->
        <div class="space-y-1.5">
          <div v-for="id in memberIds" :key="id" class="flex items-center gap-2.5 p-2.5 rounded-2xl border-2 transition"
            :class="isIn(activeModalItem, id) ? 'bg-brand-soft border-edge/70' : 'bg-surface border-line'">
            <button type="button" class="flex items-center gap-2 flex-1 min-w-0 text-left" @click="activeModalItem.splitMode === 'equal' ? toggleOnItem(activeModalItem, id) : null">
              <span class="w-8 h-8 rounded-full border border-edge/50 flex items-center justify-center text-base shrink-0" :style="{ backgroundColor: memberById(id)?.bg }">{{ memberById(id)?.avatar }}</span>
              <span class="min-w-0">
                <span class="font-extrabold text-xs text-ink block truncate">{{ memberLabelOf(id) }}</span>
                <span class="text-[10px] font-bold text-muted block">{{ isIn(activeModalItem, id) ? formatRupiah(modalShares[id]) : 'Tidak ikut' }}</span>
              </span>
            </button>

            <span v-if="activeModalItem.splitMode === 'equal'" class="w-6 h-6 rounded-lg border-2 flex items-center justify-center" :class="isIn(activeModalItem, id) ? 'bg-brand border-edge text-on-brand' : 'border-line bg-surface'" @click="toggleOnItem(activeModalItem, id)">
              <span v-if="isIn(activeModalItem, id)" class="text-xs font-black">✓</span>
            </span>

            <div v-else-if="activeModalItem.splitMode === 'shares'" class="flex items-center gap-1.5">
              <button class="w-7 h-7 rounded-full bg-surface border-2 border-edge font-black" aria-label="Kurangi" @click="stepShare(activeModalItem, id, -1)">−</button>
              <span class="w-6 text-center font-black text-sm text-ink">{{ activeModalItem.weights[id] || 0 }}</span>
              <button class="w-7 h-7 rounded-full bg-brand text-on-brand border-2 border-edge font-black" aria-label="Tambah" @click="stepShare(activeModalItem, id, 1)">+</button>
            </div>

            <div v-else class="flex items-center gap-1">
              <input type="number" min="0" inputmode="numeric" :value="activeModalItem.weights[id] || ''" placeholder="0"
                class="w-20 text-right font-black text-xs bg-page border border-line rounded-xl px-2 py-1.5 outline-none focus:border-brand"
                @input="setWeight(activeModalItem, id, $event.target.value)" />
              <span class="text-[11px] font-black text-muted w-5">{{ activeModalItem.splitMode === 'percent' ? '%' : '' }}</span>
              <button v-if="modalBalance && modalBalance.diff > 0" class="text-[10px] font-black text-brand-ink underline" @click="fillRemainder(activeModalItem, id)">isi sisa</button>
            </div>
          </div>
        </div>

        <p v-if="modalBalance" class="text-[11px] font-extrabold rounded-xl px-3 py-2"
          :class="modalBalance.diff === 0 ? 'bg-ok-soft text-ok-ink' : 'bg-warn-soft text-warn-ink'">
          <template v-if="modalBalance.diff === 0">✓ Pas {{ activeModalItem.splitMode === 'percent' ? '100%' : formatRupiah(modalBalance.target) }}</template>
          <template v-else-if="modalBalance.diff > 0">Masih sisa {{ activeModalItem.splitMode === 'percent' ? modalBalance.diff + '%' : formatRupiah(modalBalance.diff) }}</template>
          <template v-else>Kelebihan {{ activeModalItem.splitMode === 'percent' ? Math.abs(modalBalance.diff) + '%' : formatRupiah(Math.abs(modalBalance.diff)) }}</template>
          <span v-if="modalBalance.diff !== 0" class="font-semibold"> — hasil dibagi sebanding</span>
        </p>

        <button class="btn-primary w-full py-3 text-xs" @click="activeModalItem = null">Selesai</button>
      </div>
    </div>
  </div>
</template>