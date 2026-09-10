<template>
  <div
    class="sapling-system-skeleton"
    :class="{ 'monitoring-console glass-panel': !contentOnly }"
    aria-busy="true"
    :aria-label="$t('global.loading')"
  >
    <div v-if="!contentOnly" aria-hidden="true">
      <div class="monitoring-console__header">
        <div class="monitoring-console__identity">
          <v-skeleton-loader type="avatar" />
          <v-skeleton-loader class="sapling-system-skeleton__identity" type="heading, text" />
        </div>
        <div class="monitoring-console__controls">
          <v-skeleton-loader type="button" />
          <v-skeleton-loader type="button" />
          <v-skeleton-loader type="avatar" />
        </div>
      </div>
      <div class="monitoring-console__meta">
        <v-skeleton-loader v-for="item in 4" :key="item" type="text" />
      </div>
      <div class="monitoring-navigation sapling-system-skeleton__navigation">
        <v-skeleton-loader v-for="item in 5" :key="item" type="button" />
      </div>
    </div>
    <div :class="{ 'monitoring-console__content': !contentOnly }" aria-hidden="true">
      <div v-if="area === 'overview'" class="monitoring-kpis">
        <v-skeleton-loader v-for="item in 4" :key="item" type="list-item-avatar-two-line" />
      </div>
      <div v-else-if="area === 'usage'" class="monitoring-presence-summary">
        <v-skeleton-loader v-for="item in 3" :key="item" type="list-item-two-line" />
      </div>
      <div v-else-if="area === 'services'" class="monitoring-service-cards">
        <v-skeleton-loader v-for="item in 8" :key="item" type="list-item-avatar-two-line" />
      </div>
      <div
        v-if="area !== 'services' && area !== 'performance'"
        :class="area === 'usage' ? 'monitoring-usage-grid' : 'monitoring-overview-grid'"
      >
        <article v-for="item in area === 'incidents' ? 4 : 2" :key="item" class="monitoring-panel">
          <v-skeleton-loader type="heading" />
          <v-skeleton-loader
            :type="area === 'overview' ? 'list-item-two-line@4' : 'table-heading, table-row@4'"
          />
        </article>
      </div>
      <div
        v-if="['overview', 'services', 'performance'].includes(area)"
        class="monitoring-chart-grid"
      >
        <article v-for="item in 2" :key="item" class="monitoring-panel">
          <v-skeleton-loader type="subtitle, heading" />
          <v-skeleton-loader class="sapling-system-skeleton__chart" type="image" />
        </article>
      </div>
      <article v-if="area === 'performance'" class="monitoring-panel">
        <v-skeleton-loader type="heading, table-heading, table-row@4" />
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ area?: string; contentOnly?: boolean }>(), {
  area: 'overview',
  contentOnly: false,
})
</script>
