<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: { type: String, default: '' },
  id: String,
  autocomplete: { type: String, default: 'current-password' },
  placeholder: String,
})
defineEmits(['update:modelValue'])
const shown = ref(false)
</script>

<template>
  <div class="relative">
    <input
      :id="id" :value="modelValue" :type="shown ? 'text' : 'password'" :autocomplete="autocomplete"
      :placeholder="placeholder" class="input pr-20"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <button
      type="button" class="absolute inset-y-0 right-0 px-4 text-sm font-bold text-brand-ink"
      :aria-pressed="shown" @click="shown = !shown"
    >{{ shown ? 'Sembunyi' : 'Lihat' }}</button>
  </div>
</template>
