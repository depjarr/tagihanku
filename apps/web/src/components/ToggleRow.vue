<script setup>
defineProps({ modelValue: Boolean, label: String, hint: String, disabled: Boolean })
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex items-center justify-between gap-4 py-3">
    <div>
      <p class="font-bold">{{ label }}</p>
      <p v-if="hint" class="text-sm text-muted">{{ hint }}</p>
    </div>
    <button
      type="button" role="switch" :aria-checked="modelValue" :disabled="disabled"
      class="relative h-7 w-12 shrink-0 rounded-full transition"
      :class="modelValue ? 'bg-brand-ink' : 'bg-line'"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" :class="modelValue ? 'left-[22px]' : 'left-0.5'" />
    </button>
  </div>
</template>
