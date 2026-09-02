<template>
  <v-window-item class="monitoring-window-item" value="overview">
    <div class="monitoring-kpis">
      <SaplingSystemMetricCard
        icon="mdi-heart-pulse"
        icon-class="sapling-system-metric__icon--state"
        :label="$t('system.monitoringHealth')"
        :value="$t(`system.monitoringHealth_${summary?.health ?? 'unknown'}`)"
        :detail="`${number(summary?.incidents.openCount)} ${$t('system.monitoringOpenIncidents')}`"
        :value-loading="loading && !summary"
      />
      <SaplingSystemMetricCard
        icon="mdi-swap-horizontal"
        icon-class="sapling-system-metric__icon--network"
        :label="$t('system.monitoringRequests')"
        :value="compactNumber(summary?.requests.requestCount)"
        :detail="`SLO ${percent(summary?.slo.apiSuccess.actualPercent)} · p95 ${number(summary?.requests.durationP95Ms)} ms`"
        :value-loading="loading && !summary"
      />
      <SaplingSystemMetricCard
        icon="mdi-cpu-64-bit"
        icon-class="sapling-system-metric__icon--cpu"
        :label="$t('system.cpuUsage')"
        :value="percent(summary?.metrics['host.cpu.percent'])"
        :detail="`${$t('system.memory')}: ${percent(summary?.metrics['host.memory.usedPercent'])}`"
        :value-loading="loading && !summary"
      />
      <SaplingSystemMetricCard
        icon="mdi-account-multiple-check-outline"
        icon-class="sapling-system-metric__icon--state"
        :label="$t('system.monitoringOnlineUsers')"
        :value="number(summary?.users.onlineUsers)"
        :detail="`${number(summary?.users.usersWithSessions)} ${$t('system.monitoringSession')}`"
        :value-loading="loading && !summary"
      />
    </div>

    <div class="monitoring-overview-grid">
      <article class="monitoring-panel">
        <div class="monitoring-panel__header">
          <h3>{{ $t('system.monitoringCoreFlows') }}</h3>
          <span>{{ healthyServiceCount }}/{{ serviceCards.length }}</span>
        </div>
        <div class="monitoring-service-matrix">
          <div
            v-for="service in serviceCards"
            :key="service.service"
            class="monitoring-service-row"
          >
            <span class="monitoring-status-dot" :class="`is-${service.status}`" />
            <strong>{{ serviceLabel(service.service) }}</strong>
            <span>{{ service.summary || `${number(service.durationMs)} ms` }}</span>
            <time>{{ dateTime(service.lastCheckedAt) }}</time>
          </div>
          <v-empty-state
            v-if="!serviceCards.length"
            icon="mdi-shield-search-outline"
            :text="$t('system.monitoringNoData')"
          />
        </div>
      </article>

      <article class="monitoring-panel">
        <div class="monitoring-panel__header">
          <h3>{{ $t('system.monitoringIncidents') }}</h3>
          <v-btn size="small" variant="text" @click="$emit('showIncidents')">
            {{ $t('system.monitoringDetails') }}
          </v-btn>
        </div>
        <div class="monitoring-incident-stack">
          <button
            v-for="incident in openIncidents.slice(0, 5)"
            :key="incident.handle"
            class="monitoring-incident-row"
            type="button"
            @click="$emit('openIncident', incident.handle)"
          >
            <v-icon
              :color="incident.severity === 'critical' ? 'error' : 'warning'"
              icon="mdi-alert-circle"
            />
            <span>
              <strong>{{ metricLabel(incident.rule.metricKey) }}</strong>
              <small>{{ incident.dimensionKey || $t('system.monitoringGlobal') }}</small>
            </span>
            <time>{{ dateTime(incident.lastSeenAt) }}</time>
          </button>
          <v-empty-state
            v-if="!openIncidents.length"
            icon="mdi-check-circle-outline"
            :text="$t('system.monitoringNoIncidents')"
          />
        </div>
      </article>
    </div>

    <div class="monitoring-chart-grid">
      <MonitoringChart
        :eyebrow="$t('system.monitoringInfrastructure')"
        :title="$t('system.monitoringCpuMemory')"
        :points="metricPoints(['host.cpu.percent', 'host.memory.usedPercent'])"
        unit=" %"
      />
      <MonitoringChart
        :eyebrow="$t('system.monitoringRuntime')"
        :title="$t('system.monitoringEventLoop')"
        :points="metricPoints(['process.eventLoop.p95Ms'])"
        unit=" ms"
      />
    </div>
    <v-alert type="info" variant="tonal" density="compact">
      {{ $t('system.monitoringSingleHostLimitation') }}
    </v-alert>
  </v-window-item>
</template>

<script setup lang="ts">
import type {
  MonitoringIncident,
  MonitoringSeriesPoint,
  MonitoringServiceHealth,
  MonitoringSummary,
} from '@/entity/system'
import MonitoringChart from './SaplingMonitoringChart.vue'
import SaplingSystemMetricCard from './SaplingSystemMetricCard.vue'

defineProps<{
  summary: MonitoringSummary | null
  loading: boolean
  openIncidents: MonitoringIncident[]
  serviceCards: MonitoringServiceHealth[]
  healthyServiceCount: number
  number: (value: unknown) => string
  compactNumber: (value: unknown) => string
  percent: (value: unknown) => string
  dateTime: (value: string | null | undefined) => string
  serviceLabel: (value: string) => string
  metricLabel: (value: string) => string
  metricPoints: (keys: string[]) => MonitoringSeriesPoint[]
}>()

defineEmits<{
  showIncidents: []
  openIncident: [handle: number]
}>()
</script>
