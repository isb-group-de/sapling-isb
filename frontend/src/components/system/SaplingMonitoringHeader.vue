<template>
  <div class="monitoring-console__chrome">
    <header class="monitoring-console__header">
      <div class="monitoring-console__identity">
        <span class="monitoring-console__mark">
          <v-icon icon="mdi-pulse" />
        </span>
        <div class="monitoring-console__identity-copy">
          <p class="monitoring-console__eyebrow">
            {{ $t('system.system') }} · {{ $t('system.monitoringTitle') }}
          </p>
          <div class="monitoring-console__title-row">
            <h1>{{ systemTitle }}</h1>
            <v-chip :color="systemReady ? 'success' : 'error'" size="small" variant="tonal">
              <v-icon
                :icon="systemReady ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
                start
              />
              {{ systemReady ? $t('system.operational') : $t('system.requiresAttention') }}
            </v-chip>
          </div>
          <p class="monitoring-console__subtitle">{{ systemSubtitle }}</p>
        </div>
      </div>

      <div class="monitoring-console__controls">
        <v-select
          v-model="environment"
          :items="environmentOptions"
          item-title="title"
          item-value="value"
          :label="$t('system.monitoringCurrentEnvironment')"
          density="compact"
          hide-details
          variant="outlined"
        />
        <v-select
          v-model="range"
          :items="rangeOptions"
          :label="$t('system.monitoringRange')"
          density="compact"
          hide-details
          variant="outlined"
        />
        <v-btn
          icon="mdi-refresh"
          size="small"
          variant="tonal"
          :loading="refreshing"
          :title="$t('system.refresh')"
          @click="emit('refresh')"
        />
      </div>
    </header>

    <div class="monitoring-console__meta">
      <span><v-icon icon="mdi-monitor" size="16" />{{ platform }}</span>
      <span><v-icon icon="mdi-memory" size="16" />{{ architecture }}</span>
      <span><v-icon icon="mdi-source-branch" size="16" />{{ version }}</span>
      <span><v-icon icon="mdi-server" size="16" />{{ serverTime }}</span>
      <span class="monitoring-console__updated">
        <v-icon icon="mdi-database-clock-outline" size="16" />
        {{ lastUpdatedLabel }}
      </span>
    </div>

    <div
      v-if="collectorEnabled === false || maximumGapSeconds > 60"
      class="monitoring-console__notice"
      :class="collectorEnabled === false ? 'is-info' : 'is-warning'"
      role="status"
    >
      <v-icon
        :icon="collectorEnabled === false ? 'mdi-information-outline' : 'mdi-alert-outline'"
      />
      <span v-if="collectorEnabled === false">{{ $t('system.monitoringDisabled') }}</span>
      <span v-else>
        {{ $t('system.monitoringGapDetected', { seconds: formatNumber(maximumGapSeconds) }) }}
      </span>
    </div>

    <nav class="monitoring-navigation" :aria-label="$t('system.monitoringTitle')">
      <v-tabs v-model="tab" grow show-arrows>
        <v-tab prepend-icon="mdi-view-dashboard-outline" value="overview">
          {{ $t('system.monitoringOverview') }}
        </v-tab>
        <v-tab prepend-icon="mdi-alert-decagram-outline" value="incidents">
          {{ $t('system.monitoringIncidentsArea') }}
          <v-badge v-if="openIncidentCount" :content="openIncidentCount" color="error" inline />
        </v-tab>
        <v-tab prepend-icon="mdi-server-network-outline" value="services">
          {{ $t('system.monitoringServicesArea') }}
        </v-tab>
        <v-tab prepend-icon="mdi-chart-timeline-variant" value="performance">
          {{ $t('system.monitoringPerformanceArea') }}
        </v-tab>
        <v-tab prepend-icon="mdi-account-chart-outline" value="usage">
          {{ $t('system.monitoringUsageArea') }}
        </v-tab>
      </v-tabs>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  systemTitle: string
  systemSubtitle: string
  systemReady: boolean
  platform: string
  architecture: string
  version: string
  serverTime: string
  lastUpdatedLabel: string
  collectorEnabled?: boolean
  maximumGapSeconds: number
  openIncidentCount: number
  environmentOptions: Array<{ title: string; value: string }>
  rangeOptions: Array<{ title: string; value: string }>
  refreshing: boolean
}>()

const tab = defineModel<string>('tab', { required: true })
const environment = defineModel<string>('environment', { required: true })
const range = defineModel<string>('range', { required: true })
const emit = defineEmits<{ refresh: [] }>()
const { n } = useI18n()

function formatNumber(value: number): string {
  return n(value, { maximumFractionDigits: 1 })
}
</script>
