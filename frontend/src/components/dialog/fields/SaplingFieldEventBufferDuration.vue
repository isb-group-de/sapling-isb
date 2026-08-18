<template>
  <v-select
    v-model:menu="menuOpen"
    :label="label"
    :model-value="normalizedValue"
    :items="durationOptions"
    item-title="title"
    item-value="value"
    density="compact"
    hide-details="auto"
    :disabled="disabled"
    :rules="rules"
    @keydown.tab="menuOpen = false"
    @update:model-value="(value: string | null) => emit('update:modelValue', value || '00:00:00')"
  />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'

const props = defineProps<{
  label: string
  modelValue: string | null
  disabled?: boolean
  rules?: Array<(value: string | null) => boolean | string>
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const menuOpen = ref(false)

const durationOptions = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const title = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return {
    title,
    value: `${title}:00`,
  }
})

const normalizedValue = computed(() => {
  const value = props.modelValue?.trim()
  if (!value) {
    return '00:00:00'
  }
  return value.length === 5 ? `${value}:00` : value
})
</script>
