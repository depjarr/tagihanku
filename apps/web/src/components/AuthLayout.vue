<script setup>
import CatMascot from './CatMascot.vue'
defineProps({ title: String, subtitle: String })
</script>

<template>
  <main class="screen flex flex-col justify-center !pb-10">
    <div class="flex items-center gap-3">
      <CatMascot :size="56" mood="hi" />
      <div>
        <p class="eyebrow">Tagihanku</p>
        <h1 class="h1 !mt-0">{{ title }}</h1>
      </div>
    </div>
    <p v-if="subtitle" class="mt-3 text-sm font-bold text-muted">{{ subtitle }}</p>
    <div class="card mt-5 p-5"><slot /></div>
    <div class="mt-6 text-center text-sm font-bold text-muted"><slot name="footer" /></div>
  </main>
</template>