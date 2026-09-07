<template>
  <div class="sapling-dashboard-kpi-scroll" data-tutorial="dashboard-kpis">
    <SaplingKpiGrid v-if="widgets.length">
      <SaplingKpiTile
        v-for="widget in widgets"
        :key="widget.id"
        :columns="widget.columns as KpiTileSpan"
        :rows="widget.rows as KpiTileSpan"
        class="sapling-dashboard__kpi-sortable"
        :class="{
          'sapling-dashboard__kpi-sortable--active': layoutEditing,
          'sapling-dashboard__kpi-sortable--dragging': draggedHandle === widget.id,
          'sapling-dashboard__kpi-sortable--drop-target': dropTargetHandle === widget.id,
        }"
        :draggable="layoutEditing"
        @dragstart="layoutEditing && start($event, widget.id)"
        @dragenter="layoutEditing && enter($event, widget.id)"
        @dragover="layoutEditing && over($event)"
        @drop="finish"
        @dragend="finish"
      >
        <div v-if="layoutEditing" class="sapling-dashboard__kpi-drag-handle">
          <v-icon size="small">mdi-drag-variant</v-icon>{{ $t('dashboard.dragWidget') }}
        </div>
        <SaplingDashboardWidgetCard
          :key="widget.id + JSON.stringify(widget.config)"
          :widget="widget"
          :editing="layoutEditing"
          @edit="editWidget(widget)"
          @remove="openDelete(widget)"
        />
      </SaplingKpiTile>
    </SaplingKpiGrid>
    <div v-else class="sapling-empty-state-panel sapling-empty-state-panel--large glass-panel">
      <v-icon size="52" color="primary">mdi-widgets-outline</v-icon>
      <h3>{{ $t('dashboard.widgetEmptyTitle') }}</h3>
      <p>{{ $t('dashboard.widgetEmptyText') }}</p>
      <v-btn color="primary" @click="openAdd">{{ $t('dashboard.addWidget') }}</v-btn>
    </div>
    <SaplingWidgetDialog
      v-if="dialogOpen"
      :widget="editedWidget"
      :busy="saving"
      @save="saveWidget"
      @close="dialogOpen = false"
    />
    <SaplingDialogDelete
      v-model="deleteDialogOpen"
      :item="deleteItem"
      @confirm="removeWidget"
      @cancel="widgetToDelete = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DashboardItem } from '@/entity/entity'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import ApiGenericService from '@/services/api.generic.service'
import {
  getDashboardWidgets,
  cloneDashboardWidgets,
} from '@/composables/dashboard/saplingDashboardWidgets'
import { useSaplingSortableDrag } from '@/composables/dashboard/useSaplingSortableDrag'
import SaplingKpiGrid from './SaplingKpiGrid.vue'
import SaplingKpiTile, { type KpiTileSpan } from './SaplingKpiTile.vue'
import SaplingDashboardWidgetCard from './SaplingDashboardWidgetCard.vue'
import SaplingWidgetDialog from './SaplingWidgetDialog.vue'
import SaplingDialogDelete from '@/components/dialog/SaplingDialogDelete.vue'

const props = defineProps<{
  dashboard: DashboardItem
  openAddRequest?: number
  layoutEditing: boolean
}>()
const emit = defineEmits<{ (event: 'update:widgets', widgets: DashboardWidget[]): void }>()
const widgets = computed(() => getDashboardWidgets(props.dashboard))
const dialogOpen = ref(false)
const editedWidget = ref<DashboardWidget | null>(null)
const widgetToDelete = ref<DashboardWidget | null>(null)
const deleteDialogOpen = ref(false)
const deleteItem = computed(() =>
  widgetToDelete.value
    ? { handle: widgetToDelete.value.id, name: widgetToDelete.value.title }
    : null,
)
const saving = ref(false)
let lastAddRequest = 0
watch(
  () => props.openAddRequest,
  (value) => {
    if (value && value !== lastAddRequest && !props.layoutEditing) {
      lastAddRequest = value
      openAdd()
    }
  },
)
function openAdd() {
  editedWidget.value = null
  dialogOpen.value = true
}
function editWidget(widget: DashboardWidget) {
  editedWidget.value = cloneDashboardWidgets([widget])[0]!
  dialogOpen.value = true
}
function openDelete(widget: DashboardWidget) {
  widgetToDelete.value = widget
  deleteDialogOpen.value = true
}
async function persist(next: DashboardWidget[]) {
  if (props.dashboard.handle == null || saving.value) return false
  saving.value = true
  try {
    await ApiGenericService.update('dashboard', props.dashboard.handle, { widgets: next })
    emit('update:widgets', next)
    return true
  } finally {
    saving.value = false
  }
}
async function saveWidget(widget: DashboardWidget) {
  const next = widgets.value.filter((entry) => entry.id !== widget.id)
  const index = widgets.value.findIndex((entry) => entry.id === widget.id)
  next.splice(index < 0 ? next.length : index, 0, widget)
  if (props.layoutEditing) {
    emit('update:widgets', next)
    dialogOpen.value = false
  } else if (await persist(next)) dialogOpen.value = false
}
async function removeWidget() {
  if (!widgetToDelete.value) return
  if (props.layoutEditing) {
    emit(
      'update:widgets',
      widgets.value.filter((widget) => widget.id !== widgetToDelete.value?.id),
    )
    widgetToDelete.value = null
    return
  }
  if (await persist(widgets.value.filter((widget) => widget.id !== widgetToDelete.value?.id)))
    widgetToDelete.value = null
}
function move(from: string, to: string) {
  const next = widgets.value
  const fromIndex = next.findIndex((widget) => widget.id === from)
  const toIndex = next.findIndex((widget) => widget.id === to)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
  const [widget] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, widget!)
  emit('update:widgets', next)
}
const { draggedHandle, dropTargetHandle, start, enter, over, finish } =
  useSaplingSortableDrag<string>(move)
</script>
