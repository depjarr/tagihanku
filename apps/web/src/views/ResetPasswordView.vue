<script setup>
import { reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { authApi } from '../api/auth'
import AuthLayout from '../components/AuthLayout.vue'
import PasswordField from '../components/PasswordField.vue'
import PasswordRules from '../components/PasswordRules.vue'
import { passwordError } from '../composables/usePassword'

const token = String(useRoute().query.token || '')
const form = reactive({ password: '', confirm: '' })
const error = ref('')
const done = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  const pe = passwordError(form.password)
  if (pe) return (error.value = pe)
  if (form.password !== form.confirm) return (error.value = 'Konfirmasi kata sandi tidak sama')
  loading.value = true
  try {
    done.value = (await authApi.reset(token, form.password)).message
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Kata sandi baru">
    <p v-if="!token" class="notice">Tautan tidak lengkap. Minta tautan reset baru.</p>
    <p v-else-if="done" class="notice-ok">{{ done }}</p>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <p v-if="error" class="notice">{{ error }}</p>
      <div>
        <label class="label" for="password">Kata sandi baru</label>
        <PasswordField id="password" v-model="form.password" autocomplete="new-password" placeholder="Buat password baru" />
        <PasswordRules :password="form.password" />
      </div>
      <div>
        <label class="label" for="confirm">Ulangi kata sandi</label>
        <input id="confirm" v-model="form.confirm" type="password" autocomplete="new-password" class="input" />
      </div>
      <button class="btn-primary" :disabled="loading">{{ loading ? 'Menyimpan…' : 'Simpan kata sandi' }}</button>
    </form>
    <template #footer>
      <RouterLink :to="{ name: !token ? 'forgot' : 'login' }" class="font-bold text-brand-ink">
        {{ !token ? 'Minta tautan baru' : 'Ke halaman masuk' }}
      </RouterLink>
    </template>
  </AuthLayout>
</template>