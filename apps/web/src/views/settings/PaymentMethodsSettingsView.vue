<script setup>
// Metode pembayaran bawaan akun: otomatis terisi di "Buat tagihan" berikutnya.
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PaymentMethodsEditor from '../../components/PaymentMethodsEditor.vue'
import { useAuthStore } from '../../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const methods = ref(JSON.parse(JSON.stringify(auth.settings.defaultPaymentMethods || [])))
const touched = ref(false)
// pengaturan dari server bisa baru tiba setelah halaman terbuka; jangan timpa kalau sudah diubah
watch(() => auth.settings.defaultPaymentMethods, (v) => { if (!touched.value) methods.value = JSON.parse(JSON.stringify(v || [])) })
const msg = ref('')
const error = ref('')

async function save() {
  error.value = ''
  try {
    const clean = methods.value.map((m) => ({
      type: m.type, label: m.label,
      accountNumber: m.accountNumber || undefined, accountName: m.accountName || undefined,
      qrisPayload: m.type === 'QRIS' ? m.qrisPayload : undefined,
    }))
    await auth.saveSettings({ defaultPaymentMethods: clean })
    touched.value = false
    msg.value = 'Metode pembayaran disimpan'
    setTimeout(() => (msg.value = ''), 2000)
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <main class="screen">
    <button class="btn-pill" @click="router.push({ name: 'settings' })">Kembali</button>
    <h1 class="h1">Metode pembayaran</h1>
    <p class="mt-2 text-sm text-muted">Otomatis terisi setiap kali kamu membuat tagihan baru. Di tiap tagihan masih bisa diubah.</p>
    <section class="card mt-4">
      <PaymentMethodsEditor :model-value="methods" @update:model-value="(v) => { methods = v; touched = true }" />
    </section>
    <p v-if="msg" class="notice-ok mt-4">{{ msg }}</p>
    <p v-if="error" class="notice mt-4">{{ error }}</p>
    <div class="bar"><button class="btn-primary" @click="save">Simpan</button></div>
  </main>
</template>
