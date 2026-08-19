<template>
  <div class="sapling-dashboard-kpi-scroll">
    <div class="sapling-kpi-surface" data-tutorial="dashboard-kpis">
      <v-row class="sapling-kpi-grid" density="comfortable">
        <template v-if="kpis.length > 0">
          <v-col
            v-for="(kpi, kpiIdx) in kpis"
            :key="kpi.handle"
            cols="12"
            sm="6"
            md="6"
            lg="4"
            xl="3"
            class="d-flex sapling-dashboard__kpi-sortable"
            :class="{
              'sapling-dashboard__kpi-sortable--active': layoutEditing,
              'sapling-dashboard__kpi-sortable--dragging': draggedHandle === kpi.handle,
              'sapling-dashboard__kpi-sortable--drop-target': dropTargetHandle === kpi.handle,
            }"
            :draggable="layoutEditing"
            @dragstart="layoutEditing && start($event, kpi.handle)"
            @dragenter="layoutEditing && enter($event, kpi.handle)"
            @dragover="layoutEditing && over($event)"
            @drop="finish"
            @dragend="finish"
          >
            <div v-if="layoutEditing" class="sapling-dashboard__kpi-drag-handle">
              <v-icon size="small">mdi-drag-variant</v-icon>
              <span>{{ $t('dashboard.dragKpi') }}</span>
            </div>
            <SaplingKpiCard
              :kpi="kpi"
              :kpiIdx="kpiIdx"
              :onDelete="
                layoutEditing && kpi.handle != null
                  ? () => openKpiDeleteDialog(kpi.handle as number)
                  : undefined
              "
            />
          </v-col>
        </template>

        <v-col v-else cols="12">
          <div class="sapling-empty-state-panel sapling-empty-state-panel--large glass-panel">
            <v-icon size="52" color="primary">mdi-chart-box-plus-outline</v-icon>
            <h3 class="sapling-empty-state-panel__title">{{ $t('kpi.emptyTitle') }}</h3>
            <p class="sapling-empty-state-panel__text">
              {{ $t('kpi.emptyText') }}
            </p>
            <v-btn color="primary" prepend-icon="mdi-plus-circle-outline" @click="openAddKpiDialog">
              {{ $t('kpi.addKpi') }}
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </div>

    <SaplingDialogKpi
      :addKpiDialog="addKpiDialog"
      v-model:selectedKpi="selectedKpi"
      :excluded-kpi-handles="assignedKpiHandles"
      :validateAndAddKpi="validateAndAddKpi"
      :closeDialog="closeAddKpiDialog"
    />

    <SaplingDialogDelete
      v-model:modelValue="kpiDeleteDialog"
      :item="kpiToDelete"
      @confirm="confirmKpiDelete"
      @cancel="cancelKpiDelete"
    />
  </div>
</template>

<script setup lang="ts">
// #region Imports
import type { DashboardItem } from '@/entity/entity'
import SaplingKpiCard from '@/components/kpi/SaplingKpiCard.vue'
import SaplingDialogDelete from '@/components/dialog/SaplingDialogDelete.vue'
import { useSaplingKpis } from '@/composables/dashboard/useSaplingKpis'
import { useSaplingSortableDrag } from '@/composables/dashboard/useSaplingSortableDrag'
import SaplingDialogKpi from '@/components/dialog/SaplingDialogKpi.vue'
import { computed, ref, toRef, watch } from 'vue'
// #endregion

// #region Props
const props = defineProps<{
  dashboard: DashboardItem
  openAddRequest?: number
  layoutEditing: boolean
}>()

const emit = defineEmits<{
  (event: 'update:kpis', value: NonNullable<DashboardItem['kpis']>): void
}>()
// #endregion

// #region Composable
const {
  kpis,
  kpiDeleteDialog,
  kpiToDelete,
  addKpiDialog,
  selectedKpi,
  validateAndAddKpi,
  closeAddKpiDialog,
  openKpiDeleteDialog,
  confirmKpiDelete,
  cancelKpiDelete,
  openAddKpiDialog,
  reorderKpis,
} = useSaplingKpis(toRef(props, 'dashboard'), (nextKpis) => emit('update:kpis', nextKpis))

const assignedKpiHandles = computed(() =>
  kpis.value
    .map((kpi) => kpi.handle)
    .filter((handle): handle is number => typeof handle === 'number'),
)

const { draggedHandle, dropTargetHandle, start, enter, over, finish } =
  useSaplingSortableDrag(reorderKpis)
const lastHandledAddRequest = ref(0)

watch(
  () => props.openAddRequest,
  (nextRequest) => {
    if (props.layoutEditing || !nextRequest || nextRequest === lastHandledAddRequest.value) {
      return
    }

    lastHandledAddRequest.value = nextRequest
    void openAddKpiDialog()
  },
)
// #endregion
</script>
