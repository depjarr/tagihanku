<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '../components/AuthLayout.vue'
import GoogleSignIn from '../components/GoogleSignIn.vue'
import PasswordField from '../components/PasswordField.vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ name: '', email: '', password: '', agree: false })
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!form.name.trim()) return (error.value = 'Isi namamu')
  if (!form.email.trim()) return (error.value = 'Isi email')
  if (form.password.length < 8) return (error.value = 'Kata sandi minimal 8 karakter')
  if (!form.agree) return (error.value = 'Centang persetujuan syarat dan kebijakan privasi dulu')
  loading.value = true
  try {
    await auth.register({ name: form.name, email: form.email, password: form.password })
    router.replace({ name: 'home' })
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Buat akun">
    <p v-if="error" class="notice mb-4">{{ error }}</p>
    <GoogleSignIn @done="router.replace({ name: 'home' })" @error="(m) => (error = m)" />
    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label class="label" for="name">Nama</label>
        <input id="name" v-model="form.name" autocomplete="name" class="input" placeholder="Nama panggilanmu" />
      </div>
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" class="input" placeholder="kamu@email.com" />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <PasswordField id="password" v-model="form.password" autocomplete="new-password" placeholder="Minimal 8 karakter" />
      </div>
      <p class="text-sm text-muted">Tagihan yang kamu buat tanpa akun di HP ini bisa dipindahkan ke akunmu.</p>
      <label class="flex items-start gap-3 text-sm">
        <input v-model="form.agree" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--brand-ink))]" />
        <span>Saya setuju dengan syarat dan kebijakan privasi</span>
      </label>
      <button class="btn-primary" :disabled="loading">{{ loading ? 'Memproses…' : 'Daftar' }}</button>
    </form>
    <template #footer>
      Sudah punya akun? <RouterLink :to="{ name: 'login' }" class="font-bold text-brand-ink">Masuk</RouterLink>
    </template>
  </AuthLayout>
</template>
