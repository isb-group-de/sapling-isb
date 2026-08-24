<template>
  <!-- Dialog for assigning an additional KPI to the current dashboard -->
  <SaplingDialog
    :model-value="addKpiDialog"
    @update:model-value="handleDialogUpdate"
    size="sm"
    class="sapling-add-kpi-dialog"
  >
    <SaplingDialogCard class="sapling-dialog-compact-card" :close="handleCancel" :tilt="tilt">
      <div class="sapling-dialog-shell">
        <template v-if="isTranslationLoading">
          <SaplingDialogHero loading />
          <div class="sapling-dialog-form-body">
            <v-skeleton-loader elevation="12" type="article" />
          </div>
          <SaplingActionBarSkeleton :trailing="[140]" />
        </template>
        <template v-else>
          <SaplingDialogHero
            :eyebrow="$t('global.add')"
            :title="$t('navigation.kpi')"
            :subtitle="selectedKpiName"
          />

          <div class="sapling-dialog-form-body">
            <v-form ref="formRef" class="sapling-dialog-form">
              <SaplingFieldSingleSelect
                v-model="selectedKpiModel"
                entity-handle="kpi"
                :parent-filter="availableKpiFilter"
                :label="$t('navigation.kpi') + '*'"
                :rules="kpiRules"
                density="compact"
              />
            </v-form>
          </div>
          <SaplingActionSave :cancel="handleCancel" :save="handleSave" />
        </template>
      </div>
    </SaplingDialogCard>
  </SaplingDialog>
</template>

<script setup lang="ts">
// #region Imports
import { computed } from 'vue'
import type { KPIItem, SaplingGenericItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import { useSaplingDialogKpi } from '@/composables/dialog/useSaplingDialogKpi'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import SaplingActionSave from '../actions/SaplingActionSave.vue'
import SaplingActionBarSkeleton from '@/components/actions/SaplingActionBarSkeleton.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingFieldSingleSelect from '@/components/dialog/fields/SaplingFieldSingleSelect.vue'
// #endregion

// #region Props & Emits
const props = defineProps<{
  addKpiDialog: boolean
  selectedKpi?: KPIItem | null
  excludedKpiHandles?: number[]
  validateAndAddKpi: () => void | Promise<void>
  closeDialog: () => void
  tilt?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:addKpiDialog', value: boolean): void
  (event: 'update:selectedKpi', value: KPIItem | null): void
}>()
// #endregion

// #region Composable
const { formRef, kpiRules, handleDialogUpdate, handleSelectedKpiUpdate, handleCancel, handleSave } =
  useSaplingDialogKpi(emit, {
    closeDialog: props.closeDialog,
    validateAndAddKpi: props.validateAndAddKpi,
  })
const { isLoading: isTranslationLoading } = useTranslationLoader('global', 'navigation', 'kpi')

const selectedKpiModel = computed<SaplingGenericItem | null>({
  get: () => props.selectedKpi ?? null,
  set: (value) => handleSelectedKpiUpdate(value as KPIItem | null),
})

const availableKpiFilter = computed<FilterQuery>(() => ({
  ...(props.excludedKpiHandles?.length
    ? { handle: { $nin: Array.from(new Set(props.excludedKpiHandles)) } }
    : {}),
}))

const selectedKpiName = computed(() => props.selectedKpi?.name || '')
// #endregion
</script>
