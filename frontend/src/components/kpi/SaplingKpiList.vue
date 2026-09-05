<template>
  <div class="sapling-kpi-widget">
    <v-skeleton-loader v-if="loading && !isLoaded" type="text, text, text, text" />

    <div v-else-if="!hasError && !hasData" class="sapling-kpi-widget__state">
      <v-icon size="20">mdi-database-off-outline</v-icon>
      <span>{{ $t('global.noData') }}</span>
    </div>

    <SaplingDataTable
      v-else-if="!hasError"
      class="kpi-table sapling-kpi-list__table"
      :items="rows"
      :columns="
        columns.map((col) => ({
          key: col,
          title: columnLabel(col),
          value: (row: Record<string, unknown>) => row[col],
        }))
      "
    >
      <template #row="{ item: row }">
        <tr
          :class="{ 'kpi-table-row--clickable': canOpenEntity }"
          :tabindex="canOpenEntity ? 0 : undefined"
          @click="openEntity(row)"
          @keydown.enter.prevent="openEntity(row)"
          @keydown.space.prevent="openEntity(row)"
        >
          <td v-for="col in columns" :key="col">{{ row[col] }}</td>
        </tr>
      </template>
    </SaplingDataTable>
  </div>
</template>

<script lang="ts" setup>
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
// #region Imports
import { useSaplingKpiList } from '@/composables/kpi/useSaplingKpiList'
import type { KPIItem } from '@/entity/entity'
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
const { t, te } = useI18n()
function columnLabel(column: string) {
  const entity =
    typeof props.kpi.targetEntity === 'object'
      ? props.kpi.targetEntity?.handle
      : props.kpi.targetEntity
  const key = `${entity}.${column}`
  return te(key) ? t(key) : te(`global.${column}`) ? t(`global.${column}`) : column
}
// #endregion

interface SaplingKpiListProps {
  kpi: KPIItem
}

// #region Props & Composable
const props = defineProps<SaplingKpiListProps>()
const {
  rows,
  columns,
  loading,
  hasError,
  isLoaded,
  hasData,
  canOpenEntity,
  openEntity,
  loadKpiValue,
} = useSaplingKpiList(toRef(props, 'kpi'))

defineExpose({ loadKpiValue, loading, hasError, hasData, isLoaded })
// #endregion
</script>
