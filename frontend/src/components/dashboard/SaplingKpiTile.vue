<template>
  <div class="sapling-kpi-tile" :data-columns="columns" :data-rows="rows">
    <slot />
  </div>
</template>

<script setup lang="ts">
/** Grid units; tiles wider than the available column count are hidden. */
export type KpiTileSpan = 1 | 2 | 3 | 4

withDefaults(
  defineProps<{
    columns?: KpiTileSpan
    rows?: KpiTileSpan
  }>(),
  { columns: 1, rows: 2 },
)
</script>
