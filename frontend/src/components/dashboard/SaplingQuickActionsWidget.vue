<template>
  <div class="sapling-widget-quick-actions">
    <v-btn
      v-for="action in widget.config.actions"
      :key="action.id"
      variant="tonal"
      color="primary"
      prepend-icon="mdi-plus"
      :disabled="editing || busy || !canCreate(action.entity)"
      :title="canCreate(action.entity) ? action.label : $t('dashboard.widgetActionUnavailable')"
      @click="open(action.entity)"
      >{{ action.label }}</v-btn
    >
    <SaplingWidgetCreateDialog
      v-if="activeEntity"
      :key="activeEntity"
      :entity-handle="activeEntity"
      @close="activeEntity = ''"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useGenericStore } from '@/stores/genericStore'
import SaplingWidgetCreateDialog from './SaplingWidgetCreateDialog.vue'
defineProps<{ widget: Extract<DashboardWidget, { kind: 'ACTIONS' }>; editing: boolean }>()
const permissions = useCurrentPermissionStore()
const metadata = useGenericStore()
const activeEntity = ref('')
const busy = ref(false)
function canCreate(entity: string) {
  return (
    permissions.accumulatedPermission?.some(
      (p) => p.entityHandle === entity && p.allowRead && p.allowInsert,
    ) && metadata.getState(entity).entity?.canInsert !== false
  )
}
async function open(entity: string) {
  if (busy.value || !canCreate(entity)) return
  busy.value = true
  try {
    await Promise.all([
      permissions.fetchCurrentPermission(),
      metadata.loadGeneric(entity, 'global'),
    ])
    if (canCreate(entity) && metadata.getState(entity).entity) activeEntity.value = entity
  } finally {
    busy.value = false
  }
}
onMounted(() => {
  void permissions.fetchCurrentPermission()
})
</script>
