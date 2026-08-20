<template>
  <v-text-field
    :class="{ 'sapling-field-mail--disabled': disabled }"
    :label="label"
    :model-value="modelValue"
    :rules="rules"
    :maxlength="maxlength"
    :readonly="disabled"
    :required="required"
    :placeholder="placeholder"
    :append-inner-icon="canCompose ? 'mdi-email' : undefined"
    @click:append-inner="onMailClick"
    autocomplete="off"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { getCommunicationValueLabel } from '@/utils/saplingCommunicationRecordUtil'

const props = defineProps<{
  label: string
  modelValue: string
  rules?: ((value: string) => boolean | string)[]
  maxlength?: number
  disabled?: boolean
  required?: boolean
  placeholder: string
  entityHandle?: string
  itemHandle?: string | number
  draftValues?: Record<string, unknown>
  entityTemplates?: EntityTemplate[]
  canCompose?: boolean
}>()

const { openMailDialog } = useSaplingMailDialog()
const recordLabel = computed(() =>
  props.entityTemplates?.length
    ? getCommunicationValueLabel(props.draftValues as SaplingGenericItem, props.entityTemplates)
    : '',
)

function onMailClick() {
  if (!props.entityHandle || !props.canCompose) {
    return
  }

  openMailDialog({
    entityHandle: props.entityHandle,
    itemHandle: props.itemHandle,
    draftValues: props.draftValues,
    initialTo: props.modelValue ? [props.modelValue] : [],
    recordLabel: recordLabel.value,
  })
}
</script>
