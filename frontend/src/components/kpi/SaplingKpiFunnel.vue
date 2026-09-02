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
        v-css-vars="{ '--sapling-kpi-funnel-stage-width': `${item.width}%` }"
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
