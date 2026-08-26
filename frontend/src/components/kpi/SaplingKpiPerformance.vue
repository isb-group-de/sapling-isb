<template>
  <div class="sapling-kpi-widget sapling-kpi-performance">
    <v-skeleton-loader v-if="loading && !isLoaded" type="article" />
    <div v-else-if="!hasError && !hasData" class="sapling-kpi-widget__state">
      <v-icon size="20">mdi-database-off-outline</v-icon>
      <span>{{ $t('global.noData') }}</span>
    </div>
    <div v-else-if="!hasError" class="sapling-stack-md sapling-kpi-performance__content">
      <div class="sapling-kpi-performance__value">
        {{ displayValue }}<span v-if="unitLabel"> {{ unitLabel }}</span>
      </div>
      <template v-if="isTarget && targetResult">
        <div class="sapling-row-between-md">
          <span>{{ $t('kpi.targetValue') }}: {{ targetResult.targetValue }} {{ unitLabel }}</span>
          <v-chip size="small" :color="statusColor" variant="tonal">
            {{ $t(`kpi.status.${targetResult.status}`) }}
          </v-chip>
        </div>
        <v-progress-linear :model-value="progress" :color="statusColor" height="12" rounded />
        <span class="sapling-kpi-performance__progress">
          {{ (targetResult.progressPercent ?? 0).toFixed(1) }}% {{ $t('kpi.targetAttainment') }}
        </span>
      </template>
      <div v-else-if="result" class="sapling-row-between-md sapling-soft-panel">
        <span>{{ $t('kpi.numerator') }}: {{ result.primaryValue ?? '—' }}</span>
        <span v-if="result.secondaryValue != null">
          {{ $t('kpi.denominator') }}: {{ result.secondaryValue }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { KPIItem } from '@/entity/entity'
import type { KpiTargetValue } from '@/entity/structure'
import { useSaplingKpiPerformance } from '@/composables/kpi/useSaplingKpiPerformance'

const props = defineProps<{ kpi: KPIItem }>()
const {
  result,
  displayValue,
  unitLabel,
  progress,
  status,
  isTarget,
  hasData,
  loading,
  hasError,
  isLoaded,
  loadKpiValue,
} = useSaplingKpiPerformance(toRef(props, 'kpi'))
const targetResult = computed(() => (isTarget.value ? (result.value as KpiTargetValue) : null))
const statusColor = computed(() =>
  status.value === 'good' ? 'success' : status.value === 'critical' ? 'error' : 'warning',
)

defineExpose({ loadKpiValue, loading, hasError, hasData, isLoaded })
</script>

<style scoped>
.sapling-kpi-performance__value {
  font-size: var(--sapling-text-display-size-md);
  font-weight: 750;
  text-align: center;
}
.sapling-kpi-performance__progress {
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
