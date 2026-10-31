<script setup>
// "Struk lunas" — bukti bahwa teman sudah membayar bagiannya.
// HANYA untuk dilihat pembuat tagihan di perangkatnya: tidak ada tombol bagikan/unduh, dan isinya
// tidak pernah dimasukkan ke pesan WhatsApp maupun QR.
import { computed } from 'vue'
import { formatRupiah, formatDateTime, formatDate } from '../composables/format'

const props = defineProps({
  data: { type: Object, required: true }, // { billTitle, billDate, ownerName, member, payment }
})
const emit = defineEmits(['close', 'undo'])

const snap = computed(() => props.data.payment.snapshot)
const method = computed(() => props.data.payment.method)
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center p-4 overflow-y-auto" @click.self="emit('close')">
    <div class="w-full max-w-sm animate-slide-up my-auto space-y-3">
      <div class="receipt-paper relative px-5 pt-5 shadow-2xl text-[11px] leading-relaxed">
        <!-- kepala -->
        <div class="text-center space-y-0.5">
          <div class="text-2xl">🍰</div>
          <p class="font-black tracking-[.2em] text-xs">TAGIHANKU</p>
          <p class="font-bold tracking-widest text-[10px] opacity-70">STRUK PEMBAYARAN</p>
        </div>

        <p class="border-t border-dashed border-black/40 my-3" />

        <div class="space-y-0.5">
          <div class="flex justify-between"><span class="opacity-60">No. struk</span><span class="font-bold">{{ data.payment.receiptNo }}</span></div>
          <div class="flex justify-between"><span class="opacity-60">Tagihan</span><span class="font-bold text-right max-w-[60%] truncate">{{ data.billTitle }}</span></div>
          <div class="flex justify-between"><span class="opacity-60">Tgl tagihan</span><span class="font-bold">{{ formatDate(data.billDate) }}</span></div>
          <div class="flex justify-between"><span class="opacity-60">Dibayar oleh</span><span class="font-bold">{{ data.member.name }}</span></div>
          <div class="flex justify-between"><span class="opacity-60">Diterima</span><span class="font-bold">{{ data.ownerName }}</span></div>
        </div>

        <p class="border-t border-dashed border-black/40 my-3" />

        <div v-if="snap.lines.length" class="space-y-1">
          <div v-for="(l, i) in snap.lines" :key="i" class="flex justify-between gap-3">
            <span class="truncate">{{ l.name }}</span>
            <span class="font-bold whitespace-nowrap">{{ formatRupiah(l.amount) }}</span>
          </div>
        </div>
        <p v-else class="opacity-60 italic">Tidak ada rincian menu.</p>

        <p class="border-t border-dashed border-black/40 my-3" />

        <div class="space-y-1">
          <div class="flex justify-between"><span class="opacity-60">Subtotal menu</span><span class="font-bold">{{ formatRupiah(snap.itemSubtotal) }}</span></div>
          <div class="flex justify-between"><span class="opacity-60">Pajak, service &amp; lainnya</span><span class="font-bold">{{ formatRupiah(snap.extra) }}</span></div>
          <div class="flex justify-between text-sm font-black pt-1.5 border-t border-black/30">
            <span>TOTAL</span><span>{{ formatRupiah(snap.total) }}</span>
          </div>
        </div>

        <p class="border-t border-dashed border-black/40 my-3" />

        <div class="space-y-0.5">
          <div class="flex justify-between"><span class="opacity-60">Waktu lunas</span><span class="font-bold">{{ formatDateTime(data.payment.paidAt) }}</span></div>
          <div v-if="method" class="flex justify-between"><span class="opacity-60">Via</span><span class="font-bold">{{ method }}</span></div>
        </div>

        <!-- cap LUNAS -->
        <div class="flex justify-center py-4">
          <div class="animate-stamp border-4 rounded-xl px-5 py-1 font-black text-2xl tracking-[.25em] text-[#c8302a] border-[#c8302a] rotate-[-12deg]" style="font-family: 'Fredoka', system-ui, sans-serif">
            LUNAS
          </div>
        </div>

        <p class="text-center text-[10px] opacity-70 leading-snug pb-2">
          🔒 Struk ini hanya tersimpan &amp; terlihat di perangkatmu.<br />Tidak ikut terkirim ke {{ data.member.name }}.
        </p>
      </div>

      <div class="flex gap-2">
        <button class="btn-soft flex-1 py-3 text-xs" @click="emit('undo')">↩ Batalkan lunas</button>
        <button class="btn-primary flex-1 py-3 text-xs" @click="emit('close')">Tutup</button>
      </div>
    </div>
  </div>
</template>