<script setup>
// Notifikasi + dialog konfirmasi bergaya aplikasi (pengganti alert()/confirm()).
// Dipasang sekali di App.vue; dipakai lewat composables/useToast.js
import { toastState, dismiss } from '../composables/useToast'

const ICON = { success: '✅', error: '⚠️', info: '💡', warn: '🔔' }
const TONE = {
  success: 'bg-ok-soft text-ok-ink',
  error: 'bg-accent-soft text-accent',
  info: 'bg-brand-soft text-brand-ink',
  warn: 'bg-warn-soft text-warn-ink',
}
</script>

<template>
  <div>
    <!-- toast -->
    <div class="fixed inset-x-0 top-0 z-[100] pointer-events-none flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        v-for="t in toastState.items" :key="t.id"
        role="status" aria-live="polite"
        class="pointer-events-auto animate-toast w-full max-w-sm card flex items-start gap-2.5 px-3.5 py-2.5"
        :class="TONE[t.type]"
        @click="dismiss(t.id)"
      >
        <span class="text-base leading-5">{{ ICON[t.type] }}</span>
        <p class="text-xs font-extrabold leading-snug flex-1">{{ t.message }}</p>
      </div>
    </div>

    <!-- dialog konfirmasi -->
    <div v-if="toastState.dialog" class="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-5" @click.self="toastState.dialog.done(false)">
      <div class="card w-full max-w-xs p-5 space-y-3 animate-slide-up" role="alertdialog" aria-modal="true">
        <h4 class="font-display font-bold text-lg text-ink leading-tight">{{ toastState.dialog.title }}</h4>
        <p v-if="toastState.dialog.message" class="text-xs font-semibold text-muted leading-relaxed">{{ toastState.dialog.message }}</p>
        <div class="flex gap-2 pt-1">
          <button class="btn-soft flex-1 py-2.5 text-xs" @click="toastState.dialog.done(false)">{{ toastState.dialog.cancelText }}</button>
          <button class="flex-1 py-2.5 text-xs" :class="toastState.dialog.danger ? 'btn-accent' : 'btn-primary'" @click="toastState.dialog.done(true)">
            {{ toastState.dialog.okText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
