<template>
  <div class="sapling-kpi-widget sapling-kpi-funnel">
    <v-skeleton-loader v-if="loading && !isLoaded" type="list-item-three-line" />
    <div v-else-if="!hasError && !hasData" class="sapling-kpi-widget__state">
      <v-icon size="20">mdi-database-off-outline</v-icon>
      <span>{{ $t('global.noData') }}</span>
    </div>
    <div v-else-if="!hasError" class="sapling-stack-md sapling-kpi-funnel__stages">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="sapling-kpi-funnel__stage"
        :style="{ width: `${item.width}%` }"
        :disabled="!canOpenEntity"
        @click="canOpenEntity ? openEntity(item.row) : undefined"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <small>{{ item.conversion.toFixed(1) }}%</small>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import type { KPIItem } from '@/entity/entity'
import { useSaplingKpiFunnel } from '@/composables/kpi/useSaplingKpiFunnel'

const props = defineProps<{ kpi: KPIItem }>()
const { items, loading, hasError, isLoaded, hasData, canOpenEntity, openEntity, loadKpiValue } =
  useSaplingKpiFunnel(toRef(props, 'kpi'))
defineExpose({ loadKpiValue, loading, hasError, hasData, isLoaded })
</script>

<style scoped>
.sapling-kpi-funnel__stages {
  align-items: center;
}
.sapling-kpi-funnel__stage {
  align-items: center;
  background: rgb(var(--v-theme-primary));
  border: 0;
  border-radius: 8px;
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  min-height: 2.6rem;
  padding: 0.55rem 1rem;
  transition:
    filter 0.15s ease,
    width 0.25s ease;
}
.sapling-kpi-funnel__stage:not(:disabled):hover {
  filter: brightness(1.08);
}
.sapling-kpi-funnel__stage:disabled {
  cursor: default;
}
.sapling-kpi-funnel__stage small {
  opacity: 0.8;
}
</style>
