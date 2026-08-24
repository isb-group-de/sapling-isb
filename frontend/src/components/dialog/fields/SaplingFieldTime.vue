<template>
  <SaplingTextField
    :label="label"
    :model-value="modelValue"
    type="time"
    :disabled="disabled"
    :rules="rules"
    autocomplete="off"
    @update:model-value="(val) => emit('update:modelValue', val)"
  />
</template>

<script lang="ts" setup>
import SaplingTextField from '@/components/common/SaplingTextField.vue'

defineProps<{
  label: string
  modelValue: string | null
  disabled?: boolean
  rules?: Array<(value: string | null) => boolean | string>
}>()

const emit = defineEmits(['update:modelValue'])
</script>
