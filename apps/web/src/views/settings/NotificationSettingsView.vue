<script setup>
import { useRouter } from 'vue-router'
import NotificationSettings from '../../components/NotificationSettings.vue'

const router = useRouter()
</script>

<template>
  <main class="screen">
    <button class="btn-pill" @click="router.push({ name: 'settings' })">Kembali</button>
    <h1 class="h1">Notifikasi</h1>
    <p class="mt-2 text-sm text-muted">Pilih kabar apa yang ingin kamu terima.</p>
    <div class="mt-4"><NotificationSettings /></div>
  </main>
</template>
