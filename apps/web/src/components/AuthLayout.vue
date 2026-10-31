<script setup>
defineProps({ title: String, subtitle: String })
</script>

<template>
  <main class="screen flex flex-col justify-center !pb-10">
    <p class="eyebrow">Tagihanku</p>
    <h1 class="h1">{{ title }}</h1>
    <p v-if="subtitle" class="mt-2 text-muted">{{ subtitle }}</p>
    <div class="mt-6"><slot /></div>
    <div class="mt-6 text-center text-sm text-muted"><slot name="footer" /></div>
  </main>
</template>
