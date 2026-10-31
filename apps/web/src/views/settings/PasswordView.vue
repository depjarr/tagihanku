<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../../api/auth'
import PasswordField from '../../components/PasswordField.vue'
import PasswordRules from '../../components/PasswordRules.vue'
import { passwordError } from '../../composables/usePassword'
import { useAuthStore } from '../../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const pw = reactive({ current: '', next: '', confirm: '' })
const msg = ref('')
const error = ref('')

function toForgot() {
  auth.logout()
  router.push({ name: 'forgot' })
}

async function submit() {
  error.value = msg.value = ''
  const pe = passwordError(pw.next)
  if (pe) return (error.value = pe)
  if (pw.next !== pw.confirm) return (error.value = 'Konfirmasi kata sandi tidak sama')
  try {
    await authApi.changePassword(pw.current, pw.next)
    Object.assign(pw, { current: '', next: '', confirm: '' })
    msg.value = 'Kata sandi diperbarui'
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <main class="screen">
    <button class="btn-pill" @click="router.push({ name: 'settings' })">Kembali</button>
    <h1 class="h1">Ubah password</h1>

    <p v-if="auth.user && auth.user.hasPassword === false" class="card mt-4 text-sm text-muted">
      Akunmu masuk lewat Google dan belum punya kata sandi. Untuk membuatnya, keluar lalu pakai
      <button type="button" class="font-bold text-brand-ink underline" @click="toForgot">Lupa password</button>
      di halaman masuk (link dikirim ke emailmu).
    </p>
    <form v-else class="card mt-4 space-y-3" @submit.prevent="submit">
      <p v-if="msg" class="notice-ok">{{ msg }}</p>
      <p v-if="error" class="notice">{{ error }}</p>
      <div><label class="label" for="cur">Kata sandi saat ini</label><PasswordField id="cur" v-model="pw.current" /></div>
      <div><label class="label" for="new">Kata sandi baru</label><PasswordField id="new" v-model="pw.next" autocomplete="new-password" placeholder="Buat password baru" /><PasswordRules :password="pw.next" /></div>
      <div><label class="label" for="conf">Ulangi kata sandi baru</label><PasswordField id="conf" v-model="pw.confirm" autocomplete="new-password" /></div>
      <button class="btn-primary">Ganti kata sandi</button>
    </form>
  </main>
</template>