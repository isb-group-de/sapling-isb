<template>
  <div class="sapling-widget-actions-editor">
    <div
      v-for="(action, index) in model"
      :key="action.id"
      class="sapling-widget-actions-editor__row"
    >
      <SaplingFieldSingleSelect
        :model-value="action.entity ? { handle: action.entity } : null"
        entity-handle="entity"
        :parent-filter="{ handle: { $in: allowedEntities }, canInsert: true }"
        :label="$t('dashboard.widgetActionEntity')"
        :rules="[required]"
        @update:model-value="selectEntity(index, $event)"
      />
      <v-text-field
        v-model="action.label"
        :label="$t('dashboard.widgetActionLabel')"
        :rules="[required]"
        maxlength="128"
      />
      <v-btn
        icon="mdi-delete-outline"
        variant="text"
        :disabled="model.length === 1"
        :title="$t('global.delete')"
        @click="model.splice(index, 1)"
      />
    </div>
    <v-btn
      prepend-icon="mdi-plus"
      variant="tonal"
      :disabled="model.length >= 12"
      @click="addAction"
    >
      {{ $t('dashboard.widgetAddAction') }}
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
const model = defineModel<{ id: string; entity: string; label: string }[]>({ required: true })
const { t } = useI18n()
const permissions = useCurrentPermissionStore()
const allowedEntities = computed(() =>
  (permissions.accumulatedPermission ?? [])
    .filter((entry) => entry.allowRead && entry.allowInsert)
    .map((entry) => entry.entityHandle),
)
const required = (value: unknown) =>
  Boolean(typeof value === 'string' ? value.trim() : value) || t('dashboard.widgetRequired')
function addAction() {
  model.value.push({ id: crypto.randomUUID(), entity: '', label: '' })
}
function selectEntity(index: number, value: SaplingGenericItem | null) {
  const action = model.value[index]!
  action.entity = String(value?.handle ?? '')
  if (action.entity && !action.label)
    action.label = t('dashboard.widgetCreateRecord', { entity: t(`navigation.${action.entity}`) })
}
</script>
