<script setup>
// Pengaturan notifikasi; dipakai di halaman Notifikasi dan Pengaturan > Notifikasi.
import { ref } from 'vue'
import ToggleRow from './ToggleRow.vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const error = ref('')
const dayOptions = [1, 2, 3, 5, 7, 14]

async function save(patch) {
  error.value = ''
  try { await auth.saveSettings(patch) } catch (e) { error.value = e.message }
}
</script>

<template>
  <section class="card divide-y divide-line !py-1">
    <ToggleRow
      :model-value="auth.settings.notifyReminder" label="Pengingat otomatis"
      hint="Ingatkan kalau masih ada yang belum bayar"
      @update:model-value="save({ notifyReminder: $event })"
    />
    <div v-if="auth.settings.notifyReminder" class="flex items-center justify-between gap-4 py-3">
      <p class="font-bold">Ulangi tiap</p>
      <select class="input !w-auto" :value="auth.settings.reminderDays" @change="save({ reminderDays: Number($event.target.value) })">
        <option v-for="d in dayOptions" :key="d" :value="d">{{ d }} hari</option>
      </select>
    </div>
    <ToggleRow
      :model-value="auth.settings.notifyOpened" label="Saat teman membuka link"
      hint="Dapat kabar ketika temanmu memilih namanya di halaman tagihan"
      @update:model-value="save({ notifyOpened: $event })"
    />
    <ToggleRow
      :model-value="auth.settings.notifyPaid" label="Saat teman ditandai bayar"
      @update:model-value="save({ notifyPaid: $event })"
    />
    <ToggleRow
      :model-value="auth.settings.notifyDone" label="Saat semua sudah bayar"
      @update:model-value="save({ notifyDone: $event })"
    />
    <ToggleRow
      :model-value="auth.settings.notifyEmail" label="Kirim pengingat ke email"
      hint="Selain di dalam aplikasi" :disabled="!auth.settings.notifyReminder"
      @update:model-value="save({ notifyEmail: $event })"
    />
    <p v-if="error" class="notice my-3">{{ error }}</p>
  </section>
</template>
