<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { authApi } from '../api/auth'
import AuthLayout from '../components/AuthLayout.vue'

const email = ref('')
const error = ref('')
const done = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!email.value.trim()) return (error.value = 'Isi email akunmu')
  loading.value = true
  try {
    done.value = (await authApi.forgot(email.value)).message
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Lupa password" subtitle="Masukkan email akunmu. Jika terdaftar, kami kirim link untuk membuat password baru.">
    <p v-if="done" class="notice-ok">{{ done }}</p>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <p v-if="error" class="notice">{{ error }}</p>
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="email" class="input" placeholder="kamu@email.com" />
      </div>
      <button class="btn-primary" :disabled="loading">{{ loading ? 'Mengirim…' : 'Kirim link reset' }}</button>
    </form>
    <p class="mt-4 text-sm text-muted">Link berlaku 30 menit dan hanya bisa dipakai sekali. Cek folder spam kalau belum masuk.</p>
    <template #footer>
      <RouterLink :to="{ name: 'login' }" class="font-bold text-brand-ink">Ingat password? Masuk</RouterLink>
    </template>
  </AuthLayout>
</template>
