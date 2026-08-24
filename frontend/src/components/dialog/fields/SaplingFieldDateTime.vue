<template>
  <v-row density="comfortable" class="sapling-field-date-time">
    <v-col class="sapling-field-date-time__date">
      <v-date-input
        :label="computedLabel"
        :model-value="dateValue"
        :disabled="isDisabled"
        :rules="rules"
        density="compact"
        hide-details="auto"
        prepend-icon=""
        prepend-inner-icon="mdi-calendar"
        @update:model-value="updateDate"
      />
    </v-col>
    <v-col class="sapling-field-date-time__time">
      <SaplingTextField
        type="time"
        label=""
        :aria-label="`${computedLabel} time`"
        :model-value="timeValue"
        :disabled="isDisabled"
        :rules="rules"
        density="compact"
        hide-details="auto"
        @update:model-value="updateTime"
        autocomplete="off"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import { useSaplingDateTimeField } from '@/composables/fields/useSaplingDateTimeField'

const props = defineProps<{
  dateValue: string
  timeValue: string
  label: string
  disabled?: boolean
  rules?: ((value: string) => boolean | string)[]
  required?: boolean
}>()

const emit = defineEmits(['update:dateValue', 'update:timeValue'])

const { computedLabel, isDisabled, updateDate, updateTime } = useSaplingDateTimeField(props, emit)
</script>
