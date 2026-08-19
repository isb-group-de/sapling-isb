<template>
  <section
    class="sapling-dashboard__board glass-panel"
    data-tutorial="dashboard-board"
    :class="{ 'sapling-dashboard__board--layout-editing': layoutEditing }"
  >
    <div
      v-if="layoutEditing"
      class="sapling-dashboard__edit-banner"
      data-tutorial="dashboard-layout-mode"
      role="status"
    >
      <v-icon size="small">mdi-drag-variant</v-icon>
      <div>
        <strong>{{ $t('dashboard.editModeTitle') }}</strong>
        <span>{{ $t('dashboard.editModeText') }}</span>
      </div>
    </div>
    <div class="sapling-tabs-shell sapling-dashboard__tabs-shell" data-tutorial="dashboard-tabs">
      <v-tabs v-model="activeTabModel" class="sapling-dashboard__tabs" show-arrows>
        <v-tab
          v-for="(dashboard, dashboardIndex) in dashboards"
          :key="String(dashboard.handle ?? dashboardIndex)"
          :value="dashboardIndex"
          class="sapling-dashboard__tab"
          :class="{
            'sapling-dashboard__tab--sortable': layoutEditing,
            'sapling-dashboard__tab--dragging': draggedHandle === dashboard.handle,
            'sapling-dashboard__tab--drop-target': dropTargetHandle === dashboard.handle,
          }"
          :draggable="layoutEditing && dashboard.handle != null"
          @dragstart="dashboard.handle != null && start($event, dashboard.handle)"
          @dragenter="dashboard.handle != null && enter($event, dashboard.handle)"
          @dragover="over"
          @drop="finish"
          @dragend="finish"
        >
          <div class="sapling-dashboard__tab-content">
            <v-icon
              v-if="layoutEditing"
              class="sapling-dashboard__tab-drag-handle"
              size="small"
              :title="$t('dashboard.dragDashboard')"
              >mdi-drag-vertical</v-icon
            >
            <div class="sapling-dashboard__tab-copy">
              <span class="sapling-dashboard__tab-title">{{ dashboard.name }}</span>
              <span class="sapling-dashboard__tab-meta"
                >{{ dashboard.kpis?.length ?? 0 }} {{ $t('dashboard.kpis') }}</span
              >
            </div>
            <v-btn
              v-if="layoutEditing && isDashboardRemovable && dashboard.handle != null"
              icon
              variant="text"
              size="x-small"
              class="sapling-dashboard__tab-remove"
              :aria-label="`${$t('global.delete')}: ${dashboard.name}`"
              :title="`${$t('global.delete')}: ${dashboard.name}`"
              @click.stop="emit('removeDashboard', dashboard.handle)"
            >
              <v-icon size="x-small">mdi-close</v-icon>
            </v-btn>
          </div>
        </v-tab>
      </v-tabs>
    </div>

    <div class="sapling-dashboard__window">
      <v-window v-model="activeTabModel">
        <v-window-item
          v-for="(dashboard, dashboardIndex) in dashboards"
          :key="String(dashboard.handle ?? dashboardIndex)"
          :value="dashboardIndex"
        >
          <SaplingDashboardKpis
            :dashboard="dashboard"
            :open-add-request="
              dashboard.handle === addKpiRequestDashboardHandle ? addKpiRequestKey : 0
            "
            :layout-editing="layoutEditing"
            @update:kpis="emit('updateKpis', dashboard.handle, $event)"
          />
        </v-window-item>
      </v-window>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DashboardItem } from '@/entity/entity'
import SaplingDashboardKpis from '@/components/dashboard/SaplingKpis.vue'
import { useSaplingSortableDrag } from '@/composables/dashboard/useSaplingSortableDrag'

const props = defineProps<{
  dashboards: DashboardItem[]
  activeTab: number
  addKpiRequestKey: number
  addKpiRequestDashboardHandle: DashboardItem['handle'] | null
  isDashboardRemovable: boolean
  layoutEditing: boolean
}>()

const emit = defineEmits<{
  (event: 'update:activeTab', value: number): void
  (event: 'removeDashboard', handle: NonNullable<DashboardItem['handle']>): void
  (event: 'updateKpis', dashboardHandle: DashboardItem['handle'], kpis: DashboardItem['kpis']): void
  (event: 'reorderDashboards', draggedHandle: number, targetHandle: number): void
}>()

const { draggedHandle, dropTargetHandle, start, enter, over, finish } = useSaplingSortableDrag(
  (draggedHandle, targetHandle) => emit('reorderDashboards', draggedHandle, targetHandle),
)

const activeTabModel = computed({
  get: () => props.activeTab,
  set: (value: number) => emit('update:activeTab', value),
})
</script>
