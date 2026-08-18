<template>
  <v-select
    v-model:menu="menuOpen"
    :model-value="modelValue"
    :items="items"
    :label="label"
    :loading="loading"
    :disabled="disabled"
    :hide-details="hideDetails"
    :density="density"
    :variant="variant"
    @keydown.tab="menuOpen = false"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface StaticSelectItem {
  title: string
  value: unknown
}

withDefaults(
  defineProps<{
    modelValue: unknown
    items: StaticSelectItem[]
    label?: string
    loading?: boolean
    disabled?: boolean
    hideDetails?: boolean | 'auto'
    density?: 'default' | 'comfortable' | 'compact'
    variant?:
      'outlined' | 'plain' | 'underlined' | 'filled' | 'solo' | 'solo-inverted' | 'solo-filled'
  }>(),
  {
    label: '',
    loading: false,
    disabled: false,
    hideDetails: true,
    density: 'comfortable',
    variant: 'outlined',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: unknown): void
}>()

const menuOpen = ref(false)
</script>
