<template>
  <v-date-input
    :label="label"
    :model-value="modelValue"
    :disabled="disabled"
    :rules="rules"
    :error="error"
    prepend-icon=""
    prepend-inner-icon="mdi-calendar"
    autocomplete="off"
    @update:model-value="updateModelValue"
  />
</template>

<script lang="ts" setup>
import { formatLocalDate, isValidDate } from '@/composables/dialog/saplingDialogEdit.utils'

defineProps<{
  label: string
  modelValue: string | null
  disabled?: boolean
  rules?: Array<(value: string | null) => boolean | string>
  error?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void
}>()

function updateModelValue(value: string | Date | null): void {
  if (value instanceof Date) {
    emit('update:modelValue', isValidDate(value) ? formatLocalDate(value) : null)
    return
  }

  emit('update:modelValue', value)
}
</script>
