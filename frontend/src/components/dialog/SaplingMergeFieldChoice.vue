<template>
  <section
    class="sapling-update-conflict__field"
    :class="{ 'sapling-update-conflict__field--conflict': conflict }"
    @keydown.enter.stop
  >
    <div class="sapling-update-conflict__field-header">
      <h3>{{ label }}</h3>
      <slot name="status" />
    </div>
    <v-btn-toggle
      :model-value="modelValue"
      class="sapling-segmented-toggle sapling-update-conflict__toggle"
      color="primary"
      density="comfortable"
      divided
      mandatory
      :disabled="disabled"
      :aria-label="label"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <v-btn
        :value="leftSource"
        :aria-pressed="modelValue === leftSource"
        prepend-icon="mdi-arrow-left"
        class="glass-panel"
        >{{ leftLabel }}</v-btn
      >
      <v-btn
        :value="rightSource"
        :aria-pressed="modelValue === rightSource"
        prepend-icon="mdi-arrow-right"
        class="glass-panel"
        >{{ rightLabel }}</v-btn
      >
    </v-btn-toggle>
    <div class="sapling-update-conflict__values">
      <div
        class="sapling-update-conflict__value"
        :class="{ 'sapling-update-conflict__value--selected': modelValue === leftSource }"
      >
        <span>{{ leftLabel }}</span>
        <SaplingChangeLogDetailValue
          :entity-handle="entityHandle"
          :template="template"
          :value="leftValue"
          :payload="leftPayload"
        />
      </div>
      <div
        class="sapling-update-conflict__value"
        :class="{ 'sapling-update-conflict__value--selected': modelValue === rightSource }"
      >
        <span>{{ rightLabel }}</span>
        <SaplingChangeLogDetailValue
          :entity-handle="entityHandle"
          :template="template"
          :value="rightValue"
          :payload="rightPayload"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { EntityTemplate } from '@/entity/structure'
import SaplingChangeLogDetailValue from '@/components/changeLog/SaplingChangeLogDetailValue.vue'

defineProps<{
  modelValue: string | undefined
  entityHandle: string
  label: string
  template: EntityTemplate | null
  leftSource: string
  rightSource: string
  leftLabel: string
  rightLabel: string
  leftValue: unknown
  rightValue: unknown
  leftPayload?: Record<string, unknown> | null
  rightPayload?: Record<string, unknown> | null
  conflict?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
</script>
