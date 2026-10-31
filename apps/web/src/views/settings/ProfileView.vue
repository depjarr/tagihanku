<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const name = ref(auth.user?.name || '')
watch(() => auth.user, (u) => { if (u && !name.value) name.value = u.name })
const msg = ref('')
const error = ref('')

async function save() {
  error.value = msg.value = ''
  if (!name.value.trim()) return (error.value = 'Nama tidak boleh kosong')
  try {
    auth.user = { ...auth.user, ...(await authApi.updateProfile(name.value)) }
    msg.value = 'Nama disimpan'
  } catch (e) { error.value = e.message }
}
</script>

<template>
  <main class="screen">
    <button class="btn-pill" @click="router.push({ name: 'settings' })">Kembali</button>
    <h1 class="h1">Akun</h1>
    <section class="card mt-4 space-y-3">
      <p v-if="msg" class="notice-ok">{{ msg }}</p>
      <p v-if="error" class="notice">{{ error }}</p>
      <div><label class="label" for="name">Nama</label><input id="name" v-model="name" class="input" /></div>
      <div><span class="label">Email</span><p class="px-1 text-muted">{{ auth.user?.email || '…' }}</p></div>
      <button class="btn-outline" @click="save">Simpan nama</button>
    </section>
  </main>
</template>
