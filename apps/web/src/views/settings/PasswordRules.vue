<script setup>
import { computed } from 'vue'
import { passwordChecks } from '../composables/usePassword'

const props = defineProps({ password: { type: String, default: '' } })
const checks = computed(() => passwordChecks(props.password))
</script>

<template>
  <ul class="mt-2 space-y-1">
    <li v-for="c in checks" :key="c.key" class="flex items-center gap-2 text-xs font-bold" :class="c.ok ? 'text-ok-ink' : 'text-muted'">
      <span
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-edge text-[10px] leading-none"
        :class="c.ok ? 'bg-ok-soft' : 'bg-surface'"
      >{{ c.ok ? '✓' : '' }}</span>
      {{ c.label }}
    </li>
  </ul>
</template>