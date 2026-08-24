<template>
  <SaplingAutocomplete
    :model-value="modelValue"
    :items="items"
    :label="label"
    :loading="loading"
    :disabled="disabled"
    :hide-details="hideDetails"
    :density="density"
    :variant="variant"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #label>
      <span>{{ label }}</span>
      <SaplingHelpTooltip
        v-if="helpText"
        class="sapling-static-select__help"
        :text="helpText"
        :aria-label="label"
        icon-size="16"
      />
    </template>
  </SaplingAutocomplete>
</template>

<script setup lang="ts">
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingHelpTooltip from '@/components/common/SaplingHelpTooltip.vue'

interface StaticSelectItem {
  title: string
  value: unknown
}

withDefaults(
  defineProps<{
    modelValue: unknown
    items: readonly StaticSelectItem[]
    label?: string
    helpText?: string
    loading?: boolean
    disabled?: boolean
    hideDetails?: boolean | 'auto'
    density?: 'default' | 'comfortable' | 'compact'
    variant?:
      'outlined' | 'plain' | 'underlined' | 'filled' | 'solo' | 'solo-inverted' | 'solo-filled'
  }>(),
  {
    label: '',
    helpText: '',
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
</script>
