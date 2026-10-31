<script setup>
defineProps({
  name: { type: String, required: true },
  active: { type: Boolean, default: true },
  removable: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['click', 'remove'])
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border text-sm font-bold transition"
    :class="active ? 'border-brand-ink bg-brand text-on-brand' : 'border-line bg-surface text-ink'"
  >
    <button type="button" class="py-2 pl-4" :class="removable ? 'pr-2' : 'pr-4'" :disabled="disabled" @click="$emit('click')">
      {{ name }}
    </button>
    <button v-if="removable" type="button" class="py-2 pl-1 pr-3 opacity-80" :aria-label="`Hapus ${name}`" @click="$emit('remove')">
      ✕
    </button>
  </span>
</template>
