<template>
  <div class="sapling-config-toolbar sapling-form-config__toolbar">
    <SaplingAutocomplete
      v-model="selectedEntityHandle"
      class="sapling-form-config__entity-select"
      :items="entityOptions"
      item-title="title"
      item-value="value"
      prepend-inner-icon="mdi-table"
      density="comfortable"
      hide-details
      :label="$t('formConfig.entity')"
      :loading="loadingEntities"
    />
    <SaplingAutocomplete
      v-model="selectedConfigHandle"
      class="sapling-form-config__config-select"
      :items="configOptions"
      item-title="title"
      item-value="value"
      prepend-inner-icon="mdi-tune-variant"
      density="comfortable"
      hide-details
      :label="$t('formConfig.configuration')"
      :disabled="!selectedEntityHandle"
    />
    <v-btn
      icon="mdi-plus"
      variant="tonal"
      :title="$t('formConfig.newConfig')"
      :disabled="!selectedEntityHandle"
      @click="$emit('startNew')"
    />
  </div>

  <div class="sapling-config-settings sapling-form-config__settings">
    <SaplingTextField
      v-model="configName"
      density="comfortable"
      :label="$t('formConfig.name')"
      prepend-inner-icon="mdi-label-outline"
    />
    <SaplingAutocomplete
      v-model="configScope"
      density="comfortable"
      :items="scopeOptions"
      item-title="title"
      item-value="value"
      :label="$t('formConfig.scope')"
      prepend-inner-icon="mdi-account-filter-outline"
    />
    <div class="sapling-form-config__scope-handle">
      <SaplingFieldSingleSelect
        v-if="scopeSelectEntityHandle"
        :key="scopeSelectKey"
        v-model="selectedScopeItem"
        :label="$t('formConfig.scopeHandle')"
        :entity-handle="scopeSelectEntityHandle"
        :placeholder="scopeHandle"
        density="comfortable"
        hide-details
      />
      <SaplingTextField
        v-else
        v-model="scopeHandle"
        density="comfortable"
        hide-details
        :label="$t('formConfig.scopeHandle')"
        prepend-inner-icon="mdi-pound"
        disabled
      />
    </div>
    <div class="sapling-row-md sapling-config-switches sapling-form-config__switches">
      <SaplingSwitch
        v-model="isActive"
        color="primary"
        hide-details
        density="compact"
        :label="$t('formConfig.active')"
      />
      <SaplingSwitch
        v-model="isDefault"
        color="primary"
        hide-details
        density="compact"
        :label="$t('formConfig.defaultConfig')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
import type { SaplingGenericItem } from '@/entity/entity'

type ScopeValue = 'global' | 'role' | 'person'
type SelectOption = { title: string; value: string | number | null }

defineProps<{
  entityOptions: SelectOption[]
  configOptions: SelectOption[]
  scopeOptions: Array<{ title: string; value: ScopeValue }>
  scopeSelectEntityHandle: string
  scopeSelectKey: string
  loadingEntities: boolean
}>()

defineEmits<{ startNew: [] }>()

const selectedEntityHandle = defineModel<string>('selectedEntityHandle', { required: true })
const selectedConfigHandle = defineModel<number | null>('selectedConfigHandle', { required: true })
const configName = defineModel<string>('configName', { required: true })
const configScope = defineModel<ScopeValue>('configScope', { required: true })
const scopeHandle = defineModel<string>('scopeHandle', { required: true })
const selectedScopeItem = defineModel<SaplingGenericItem | null>('selectedScopeItem', {
  required: true,
})
const isActive = defineModel<boolean>('isActive', { required: true })
const isDefault = defineModel<boolean>('isDefault', { required: true })
</script>
