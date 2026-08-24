<template>
  <SaplingTextField
    :class="{ 'sapling-field-phone--disabled': disabled }"
    :label="label"
    :model-value="formattedModelValue"
    :rules="rules"
    :maxlength="maxlength"
    :readonly="disabled"
    :required="required"
    :placeholder="placeholder"
    append-inner-icon="mdi-phone"
    autocomplete="off"
    @click:append-inner="onPhoneClick"
    @update:model-value="updateModelValue"
  />
</template>

<script lang="ts" setup>
import { computed, toRef, watch } from 'vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import { useSaplingPhoneDialog } from '@/composables/dialog/useSaplingPhoneDialog'
import { useSaplingPhoneNumber } from '@/composables/phone/useSaplingPhoneNumber'
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
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const { openPhoneDialog } = useSaplingPhoneDialog()
const { currentCountryHandle, currentDialingCode, formatPhoneNumber } = useSaplingPhoneNumber()
const modelValue = toRef(props, 'modelValue')
const formattedModelValue = computed(() => formatPhoneNumber(props.modelValue))
const recordLabel = computed(() =>
  props.entityTemplates?.length
    ? getCommunicationValueLabel(props.draftValues as SaplingGenericItem, props.entityTemplates)
    : '',
)

watch(
  [modelValue, currentCountryHandle, currentDialingCode],
  ([value]) => {
    const formattedValue = formatPhoneNumber(value)
    if (formattedValue !== value) {
      emit('update:modelValue', formattedValue)
    }
  },
  { immediate: true },
)

function updateModelValue(value: string) {
  emit('update:modelValue', formatPhoneNumber(value))
}

function onPhoneClick() {
  const formattedValue = formatPhoneNumber(props.modelValue)
  if (formattedValue) {
    openPhoneDialog({
      entityHandle: props.entityHandle,
      itemHandle: props.itemHandle,
      draftValues: props.draftValues,
      phoneNumber: formattedValue,
      recordLabel: recordLabel.value,
    })
  }
}
</script>
