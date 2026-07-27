<template>
  <div class="sapling-inline-cluster sapling-field-select-add">
    <SaplingSelectField
      class="sapling-field-select-add__field"
      :label="props.label"
      :entity-handle="props.entityHandle"
      :rules="props.rules"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :parent-filter="props.parentFilter"
      v-model="selectedItems"
      @update:modelValue="onUpdateModelValue"
    />
    <v-btn-group class="sapling-field-select-add__actions">
      <v-btn
        color="primary"
        :disabled="props.disabled || !selectedItems.length"
        :loading="props.loading"
        @click="emitAddSelected"
        :icon="showActionLabel ? undefined : true"
        :prepend-icon="showActionLabel ? actionIcon : undefined"
        :title="resolvedActionLabel"
      >
        <v-icon v-if="!showActionLabel" :icon="actionIcon" />
        <span v-if="showActionLabel">{{ resolvedActionLabel }}</span>
      </v-btn>
    </v-btn-group>
  </div>
</template>

<script lang="ts" setup>
import { useSaplingSelectAddField } from '@/composables/fields/useSaplingSelectAddField'
import type { SaplingGenericItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import { computed, defineAsyncComponent, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const SaplingSelectField = defineAsyncComponent(() => import('./SaplingFieldSelect.vue'))

const props = defineProps<{
  label: string
  entityHandle: string
  modelValue?: SaplingGenericItem[]
  rules?: Array<(v: unknown) => true | string>
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  parentFilter?: FilterQuery
  actionLabel?: string
  actionIcon?: string
  showActionLabel?: boolean
}>()
const emit = defineEmits(['update:modelValue', 'add-selected'])
const { t } = useI18n()

const { selectedItems } = useSaplingSelectAddField(props)
const actionIcon = computed(() => props.actionIcon?.trim() || 'mdi-plus')
const resolvedActionLabel = computed(() => props.actionLabel?.trim() || t('global.addSelected'))

function emitAddSelected() {
  if (selectedItems.value.length) {
    emit('add-selected', selectedItems.value)
  }
}

function onUpdateModelValue(val: SaplingGenericItem[] | null) {
  emit('update:modelValue', val)
}

watch(selectedItems, (val) => {
  emit('update:modelValue', val)
})
</script>
