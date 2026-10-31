<script setup>
import { computed, reactive, ref } from 'vue'
import { number, rupiah, toInt } from '../composables/useFormat'
import ParticipantChip from './ParticipantChip.vue'

const props = defineProps({
  item: { type: Object, required: true },
  participants: { type: Array, required: true },
})
const emit = defineEmits(['toggle', 'update', 'remove'])

const editing = ref(false)
const draft = reactive({ name: '', price: '' })

const perPerson = computed(() =>
  props.item.participantIds.length > 1 ? Math.round(props.item.price / props.item.participantIds.length) : 0,
)

function startEdit() {
  draft.name = props.item.name
  draft.price = number(props.item.price)
  editing.value = true
}
function save() {
  if (!draft.name.trim()) return
  emit('update', { name: draft.name.trim(), price: toInt(draft.price) })
  editing.value = false
}
</script>

<template>
  <div class="card" :class="{ 'border-warn': item.participantIds.length === 0 }">
    <div v-if="!editing" class="flex items-start justify-between gap-3">
      <button type="button" class="text-left text-lg font-semibold" @click="startEdit">
        {{ item.name }}<span v-if="item.participantIds.length > 1 && item.participantIds.length < participants.length" class="font-medium text-muted"> (dibagi)</span>
      </button>
      <span class="shrink-0 text-lg font-bold">{{ rupiah(item.price) }}</span>
    </div>
    <div v-else class="flex gap-2">
      <input v-model="draft.name" class="input" placeholder="Nama item" />
      <input v-model="draft.price" class="input w-32 text-right" inputmode="numeric" @keyup.enter="save" />
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <ParticipantChip
        v-for="p in participants"
        :key="p.id"
        :name="p.name"
        :active="item.participantIds.includes(p.id)"
        @click="emit('toggle', p.id)"
      />
    </div>

    <p v-if="item.participantIds.length === 0" class="mt-2 text-sm font-semibold text-warn-ink">Belum ada yang dipilih</p>
    <p v-else-if="perPerson" class="mt-2 text-sm text-muted">{{ rupiah(perPerson) }} per orang</p>

    <div v-if="editing" class="mt-3 flex gap-2">
      <button type="button" class="btn-pill flex-1" @click="save">Simpan</button>
      <button type="button" class="btn-pill flex-1" @click="editing = false">Batal</button>
      <button type="button" class="btn-pill text-danger" @click="emit('remove')">Hapus</button>
    </div>
  </div>
</template>
