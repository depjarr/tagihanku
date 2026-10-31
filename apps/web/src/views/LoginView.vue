<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import GoogleSignIn from '../components/GoogleSignIn.vue'
import PasswordField from '../components/PasswordField.vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)

const goNext = () =>
  router.replace(typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : { name: 'home' })

async function submit() {
  error.value = ''
  if (!form.email.trim() || !form.password) return (error.value = 'Isi email dan kata sandi')
  loading.value = true
  try {
    await auth.login({ email: form.email, password: form.password })
    goNext()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Masuk" subtitle="Simpan riwayat tagihan dan buka dari perangkat mana saja.">
    <p v-if="error" class="notice mb-4">{{ error }}</p>
    <GoogleSignIn @done="goNext" @error="(m) => (error = m)" />
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" class="input" placeholder="kamu@email.com" />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <PasswordField id="password" v-model="form.password" />
        <RouterLink :to="{ name: 'forgot' }" class="mt-2 inline-block text-sm font-bold text-brand-ink">Lupa password?</RouterLink>
      </div>
      <button class="btn-primary" :disabled="loading">{{ loading ? 'Memproses…' : 'Masuk' }}</button>
    </form>
    <template #footer>
      Belum punya akun? <RouterLink :to="{ name: 'register' }" class="font-bold text-brand-ink">Daftar</RouterLink>
      <br />
      <RouterLink :to="{ name: 'home' }" class="mt-2 inline-block">Lanjut tanpa akun</RouterLink>
    </template>
  </AuthLayout>
</template>
