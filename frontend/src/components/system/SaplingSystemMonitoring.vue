<template>
  <section class="monitoring-workspace">
    <header class="monitoring-commandbar glass-panel sapling-data-card">
      <div class="monitoring-commandbar__identity">
        <span class="monitoring-commandbar__pulse"><v-icon icon="mdi-pulse" /></span>
        <div>
          <strong>{{ $t('system.monitoringTitle') }}</strong>
          <span>{{ lastUpdatedLabel }}</span>
        </div>
      </div>
      <div class="monitoring-commandbar__controls">
        <v-select
          v-model="selectedEnvironment"
          :items="environmentOptions"
          item-title="title"
          item-value="value"
          :label="$t('system.monitoringCurrentEnvironment')"
          density="compact"
          hide-details
        />
        <v-select
          v-model="rangePreset"
          :items="rangeOptions"
          :label="$t('system.monitoringRange')"
          density="compact"
          hide-details
        />
        <v-btn
          icon="mdi-refresh"
          size="small"
          variant="tonal"
          :loading="loading"
          :title="$t('system.refresh')"
          @click="loadAll"
        />
      </div>
    </header>

    <v-alert v-if="collectorEnabled === false" type="info" variant="tonal">
      {{ $t('system.monitoringDisabled') }}
    </v-alert>
    <v-alert v-else-if="maximumGapSeconds > 60" type="warning" variant="tonal">
      {{ $t('system.monitoringGapDetected', { seconds: number(maximumGapSeconds) }) }}
    </v-alert>

    <nav class="monitoring-navigation glass-panel sapling-data-card">
      <v-tabs v-model="tab" grow show-arrows>
        <v-tab prepend-icon="mdi-view-dashboard-outline" value="overview">
          {{ $t('system.monitoringOverview') }}
        </v-tab>
        <v-tab prepend-icon="mdi-alert-decagram-outline" value="incidents">
          {{ $t('system.monitoringIncidentsArea') }}
          <v-badge
            v-if="openIncidents.length"
            :content="openIncidents.length"
            color="error"
            inline
          />
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

    <v-window v-model="tab" class="monitoring-window">
      <v-window-item value="overview">
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
            :detail="`${number(summary?.users.usersWithSessions)} ${$t('system.monitoringValidSessions')}`"
            :value-loading="loading && !summary"
          />
        </div>

        <div class="monitoring-overview-grid">
          <article class="glass-panel sapling-data-card monitoring-panel">
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

          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringIncidents') }}</h3>
              <v-btn size="small" variant="text" @click="tab = 'incidents'">
                {{ $t('system.monitoringDetails') }}
              </v-btn>
            </div>
            <div class="monitoring-incident-stack">
              <button
                v-for="incident in openIncidents.slice(0, 5)"
                :key="incident.handle"
                class="monitoring-incident-row"
                type="button"
                @click="openIncident(incident.handle)"
              >
                <v-icon
                  :color="incident.severity === 'critical' ? 'error' : 'warning'"
                  icon="mdi-alert-circle"
                />
                <span>
                  <strong>{{ incident.rule.title }}</strong>
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

      <v-window-item value="incidents">
        <div class="monitoring-incident-grid">
          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringIncidents') }}</h3>
              <v-btn
                prepend-icon="mdi-tune-variant"
                size="small"
                variant="tonal"
                @click="rulesOpen = true"
              >
                {{ $t('system.monitoringAlertRules') }}
              </v-btn>
            </div>
            <div class="monitoring-incident-stack">
              <button
                v-for="incident in incidents"
                :key="incident.handle"
                class="monitoring-incident-row"
                type="button"
                @click="openIncident(incident.handle)"
              >
                <v-icon
                  :color="incident.state === 'resolved' ? 'success' : incident.severity"
                  icon="mdi-alert-circle-outline"
                />
                <span>
                  <strong>{{ incident.rule.title }}</strong>
                  <small>{{ incident.state }} · {{ incident.incidentType || 'threshold' }}</small>
                </span>
                <time>{{ dateTime(incident.lastSeenAt) }}</time>
              </button>
            </div>
          </article>

          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringErrorsAndCauses') }}</h3>
              <span>{{ errorGroups.length }}</span>
            </div>
            <v-table class="sapling-table monitoring-table" density="compact">
              <thead>
                <tr>
                  <th>{{ $t('system.monitoringSource') }}</th>
                  <th>{{ $t('system.monitoringOperation') }}</th>
                  <th>{{ $t('system.monitoringCount') }}</th>
                  <th>{{ $t('system.monitoringLastSeen') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="group in errorGroups" :key="group.handle">
                  <td>
                    <v-chip size="x-small" variant="tonal">{{ group.source }}</v-chip>
                  </td>
                  <td>
                    <strong>{{ group.operation }}</strong
                    ><small class="monitoring-table__secondary"
                      >{{ group.latestErrorClass }} · {{ group.latestMessage }}</small
                    >
                  </td>
                  <td>{{ number(group.occurrenceCount) }}</td>
                  <td>{{ dateTime(group.lastSeenAt) }}</td>
                </tr>
              </tbody>
            </v-table>
          </article>
        </div>

        <div class="monitoring-incident-grid">
          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringChecks') }}</h3>
              <span>{{ checks.length }}</span>
            </div>
            <v-table class="sapling-table monitoring-table" density="compact">
              <thead>
                <tr>
                  <th>{{ $t('system.monitoringCheck') }}</th>
                  <th>{{ $t('system.monitoringStatus') }}</th>
                  <th>{{ $t('system.monitoringDuration') }}</th>
                  <th>{{ $t('system.monitoringTime') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="check in checks.slice(0, 20)" :key="check.handle">
                  <td>{{ check.checkKey }}</td>
                  <td>
                    <v-chip :color="statusColor(check.status)" size="x-small">{{
                      check.status
                    }}</v-chip>
                  </td>
                  <td>{{ number(check.durationMs) }} ms</td>
                  <td>{{ dateTime(check.completedAt) }}</td>
                </tr>
              </tbody>
            </v-table>
          </article>
          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringRemediationHistory') }}</h3>
              <span>{{ remediations.length }}</span>
            </div>
            <v-table class="sapling-table monitoring-table" density="compact">
              <thead>
                <tr>
                  <th>{{ $t('system.monitoringAction') }}</th>
                  <th>{{ $t('system.monitoringMode') }}</th>
                  <th>{{ $t('system.monitoringResult') }}</th>
                  <th>{{ $t('system.monitoringTime') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="execution in remediations" :key="execution.handle">
                  <td>{{ execution.actionKey }}</td>
                  <td>{{ execution.mode }}</td>
                  <td>
                    <v-chip
                      :color="execution.state === 'succeeded' ? 'success' : 'warning'"
                      size="x-small"
                      >{{ execution.state }}</v-chip
                    >
                  </td>
                  <td>{{ dateTime(execution.startedAt) }}</td>
                </tr>
              </tbody>
            </v-table>
          </article>
        </div>
      </v-window-item>

      <v-window-item value="services">
        <div class="monitoring-service-cards">
          <article
            v-for="service in serviceCards"
            :key="service.service"
            class="glass-panel sapling-data-card monitoring-service-card"
          >
            <span class="monitoring-status-dot" :class="`is-${service.status}`" />
            <div>
              <strong>{{ serviceLabel(service.service) }}</strong
              ><small>{{ service.summary || `${number(service.durationMs)} ms` }}</small>
            </div>
            <time>{{ dateTime(service.lastCheckedAt) }}</time>
          </article>
        </div>
        <div class="monitoring-slot-stack">
          <slot name="database" />
          <slot name="storage" />
          <slot name="network" />
          <slot name="system" />
        </div>
      </v-window-item>

      <v-window-item value="performance">
        <div class="monitoring-slot-stack"><slot name="performance" /></div>
        <div class="monitoring-chart-grid">
          <MonitoringChart
            :eyebrow="$t('system.monitoringRequests')"
            :title="$t('system.monitoringRequestAnalysis')"
            :points="requestSeries"
          />
          <MonitoringChart
            :eyebrow="$t('system.monitoringRuntime')"
            :title="$t('system.monitoringProcessMemory')"
            :points="metricPoints(['process.memory.rssBytes', 'process.memory.heapUsedBytes'])"
          />
        </div>
        <article class="glass-panel sapling-data-card monitoring-panel">
          <div class="monitoring-panel__header">
            <h3>{{ $t('system.monitoringRequestAnalysis') }}</h3>
            <span>{{ requestGroups.length }}</span>
          </div>
          <v-table class="sapling-table monitoring-table" density="compact">
            <thead>
              <tr>
                <th>{{ $t('system.monitoringCategory') }}</th>
                <th>{{ $t('system.monitoringRequests') }}</th>
                <th>{{ $t('system.monitoringErrors') }}</th>
                <th>p50</th>
                <th>p95</th>
                <th>p99</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in requestGroups" :key="String(row.group)">
                <td>{{ row.group }}</td>
                <td>{{ number(row.requestCount) }}</td>
                <td>{{ number(row.serverErrorCount) }}</td>
                <td>{{ number(row.durationP50Ms) }} ms</td>
                <td>{{ number(row.durationP95Ms) }} ms</td>
                <td>{{ number(row.durationP99Ms) }} ms</td>
              </tr>
            </tbody>
          </v-table>
        </article>
      </v-window-item>

      <v-window-item value="usage">
        <div class="monitoring-usage-grid">
          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringUsers') }}</h3>
              <span>{{ usersTotal }}</span>
            </div>
            <v-table class="sapling-table monitoring-table" density="compact">
              <thead>
                <tr>
                  <th>{{ $t('system.monitoringUser') }}</th>
                  <th>{{ $t('system.monitoringRequests') }}</th>
                  <th>{{ $t('system.monitoringErrors') }}</th>
                  <th>{{ $t('system.monitoringTokens') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.handle">
                  <td>{{ [user.firstName, user.lastName].filter(Boolean).join(' ') }}</td>
                  <td>{{ number(user.requests) }}</td>
                  <td>{{ number(user.errors) }}</td>
                  <td>{{ compactNumber(user.tokens) }}</td>
                </tr>
              </tbody>
            </v-table>
          </article>
          <article class="glass-panel sapling-data-card monitoring-panel">
            <div class="monitoring-panel__header">
              <h3>{{ $t('system.monitoringAiTokens') }}</h3>
              <span>{{ aiGroups.length }}</span>
            </div>
            <v-table class="sapling-table monitoring-table" density="compact">
              <thead>
                <tr>
                  <th>{{ $t('system.monitoringProvider') }}</th>
                  <th>{{ $t('system.monitoringCalls') }}</th>
                  <th>{{ $t('system.monitoringErrors') }}</th>
                  <th>{{ $t('system.monitoringTokens') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in aiGroups" :key="String(row.group)">
                  <td>{{ row.group }}</td>
                  <td>{{ number(row.callCount) }}</td>
                  <td>{{ number(row.errorCount) }}</td>
                  <td>{{ compactNumber(row.totalTokens) }}</td>
                </tr>
              </tbody>
            </v-table>
          </article>
        </div>
      </v-window-item>
    </v-window>

    <SaplingDialog v-model="rulesOpen" size="lg">
      <v-card class="sapling-dialog-compact-card">
        <v-card-title>{{ $t('system.monitoringAlertRules') }}</v-card-title>
        <v-card-text class="monitoring-rules">
          <div v-for="rule in rules" :key="rule.handle" class="monitoring-rule-row">
            <SaplingSwitch
              v-model="rule.isActive"
              hide-details
              density="compact"
              @update:model-value="updateRule(rule)"
            />
            <span
              ><strong>{{ rule.title }}</strong
              ><small>{{ rule.metricKey }} · {{ rule.evaluationType || 'threshold' }}</small></span
            >
            <v-chip v-if="rule.shadowMode" size="x-small">Shadow</v-chip>
            <v-chip :color="rule.severity === 'critical' ? 'error' : 'warning'" size="x-small">{{
              rule.severity
            }}</v-chip>
          </div>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn @click="rulesOpen = false">{{
            $t('global.close')
          }}</v-btn></v-card-actions
        >
      </v-card>
    </SaplingDialog>

    <SaplingDialog v-model="incidentOpen" size="md" @after-leave="closeIncident">
      <v-card v-if="selectedIncident" class="sapling-dialog-compact-card">
        <v-card-title>{{ selectedIncident.rule.title }}</v-card-title>
        <v-card-subtitle>
          {{ selectedIncident.state }} · {{ selectedIncident.severity }} ·
          {{ dateTime(selectedIncident.lastSeenAt) }}
        </v-card-subtitle>
        <v-card-text>
          <dl class="monitoring-diagnosis">
            <template v-for="(value, key) in selectedIncident.diagnosis || {}" :key="key">
              <dt>{{ key }}</dt>
              <dd>{{ value }}</dd>
            </template>
          </dl>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="selectedIncident.state === 'open' && selectedIncident.rule.remediationActionKey"
            color="primary"
            prepend-icon="mdi-auto-fix"
            variant="tonal"
            :loading="remediationPending"
            @click="remediateSelectedIncident"
          >
            {{ $t('system.monitoringExecuteRemediation') }}
          </v-btn>
          <v-spacer />
          <v-btn @click="incidentOpen = false">{{ $t('global.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </SaplingDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingSystemMetricCard from './SaplingSystemMetricCard.vue'
import MonitoringChart from './SaplingMonitoringChart.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import { useSaplingSystemMonitoring } from '@/composables/system/useSaplingSystemMonitoring'

const route = useRoute()
const router = useRouter()
const { t, n, locale } = useI18n()
const validAreas = new Set(['overview', 'incidents', 'services', 'performance', 'usage'])
const initialArea =
  typeof route.query.area === 'string' && validAreas.has(route.query.area)
    ? route.query.area
    : 'overview'
const tab = ref(initialArea)
const rulesOpen = ref(false)
const incidentOpen = ref(typeof route.query.incident === 'string')
const remediationPending = ref(false)

const {
  rangePreset,
  selectedEnvironment,
  environments,
  summary,
  series,
  requestSeries,
  requestGroups,
  users,
  usersTotal,
  aiGroups,
  incidents,
  rules,
  collectorStatus,
  services,
  errorGroups,
  checks,
  remediations,
  loading,
  loadAll,
  updateRule,
  executeRemediation,
} = useSaplingSystemMonitoring(tab)

const rangeOptions = [
  { title: '1h', value: '1h' },
  { title: '6h', value: '6h' },
  { title: '24h', value: '24h' },
  { title: '7d', value: '7d' },
  { title: '30d', value: '30d' },
  { title: '90d', value: '90d' },
]
const environmentOptions = computed(() =>
  environments.value.map((item) => ({
    title: `${item.name} · ${item.kind}`,
    value: item.handle,
  })),
)
const openIncidents = computed(() => incidents.value.filter((item) => item.state === 'open'))
const selectedIncident = computed(() => {
  const handle = Number(route.query.incident)
  return Number.isSafeInteger(handle)
    ? (incidents.value.find((incident) => incident.handle === handle) ?? null)
    : null
})
const serviceCards = computed(() => services.value)
const healthyServiceCount = computed(
  () => serviceCards.value.filter((item) => item.status === 'healthy').length,
)
const collectorEnabled = computed(() => {
  const collector = collectorStatus.value?.collector as Record<string, unknown> | undefined
  return typeof collector?.enabled === 'boolean' ? collector.enabled : undefined
})
const maximumGapSeconds = computed(() => {
  const instances = collectorStatus.value?.instances
  if (!Array.isArray(instances)) return 0
  return Math.max(
    0,
    ...instances.map((item) => Number((item as Record<string, unknown>).gapSeconds ?? 0)),
  )
})
const lastUpdatedLabel = computed(() =>
  summary.value?.lastSampleAt ? dateTime(summary.value.lastSampleAt) : t('global.notAvailable'),
)

watch(tab, (area) => {
  void router.replace({ query: { ...route.query, area } })
})

function metricPoints(keys: string[]) {
  return series.value.filter((point) => keys.includes(point.metricKey))
}

function number(value: unknown): string {
  const numeric = Number(value ?? 0)
  return n(Number.isFinite(numeric) ? numeric : 0, { maximumFractionDigits: 1 })
}

function compactNumber(value: unknown): string {
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0))
}

function percent(value: unknown): string {
  return `${number(value)} %`
}

function dateTime(value: string | null | undefined): string {
  if (!value) return t('global.notAvailable')
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function serviceLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function statusColor(value: string): string {
  return value === 'healthy' ? 'success' : value === 'critical' ? 'error' : 'warning'
}

function openIncident(handle: number): void {
  tab.value = 'incidents'
  incidentOpen.value = true
  void router.replace({ query: { ...route.query, area: 'incidents', incident: String(handle) } })
}

function closeIncident(): void {
  if (route.query.incident == null) return
  const query = { ...route.query }
  delete query.incident
  void router.replace({ query })
}

async function remediateSelectedIncident(): Promise<void> {
  const incident = selectedIncident.value
  const actionKey = incident?.rule.remediationActionKey
  if (!incident || !actionKey) return
  remediationPending.value = true
  try {
    await executeRemediation(actionKey, incident.handle)
  } finally {
    remediationPending.value = false
  }
}
</script>

<style scoped>
.monitoring-workspace {
  display: grid;
  gap: 14px;
  margin-bottom: 28px;
}
.monitoring-commandbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 74px;
  padding: 12px 16px;
}
.monitoring-commandbar__identity,
.monitoring-commandbar__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.monitoring-commandbar__identity > div {
  display: grid;
  gap: 2px;
}
.monitoring-commandbar__identity span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8rem;
}
.monitoring-commandbar__pulse {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.monitoring-commandbar__controls > :not(.v-btn) {
  width: 190px;
}
.monitoring-navigation {
  position: sticky;
  top: 66px;
  z-index: 5;
  overflow: hidden;
  padding: 0 6px;
}
.monitoring-window {
  min-height: 420px;
}
.monitoring-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.monitoring-overview-grid,
.monitoring-incident-grid,
.monitoring-usage-grid,
.monitoring-chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.monitoring-panel {
  min-width: 0;
  padding: 16px;
  overflow-x: auto;
}
.monitoring-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.monitoring-panel__header h3 {
  margin: 0;
  font-size: 1rem;
}
.monitoring-panel__header > span {
  color: rgb(var(--v-theme-on-surface-variant));
}
.monitoring-service-matrix,
.monitoring-incident-stack {
  display: grid;
}
.monitoring-service-row {
  display: grid;
  grid-template-columns: 12px minmax(100px, 0.7fr) minmax(120px, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.monitoring-service-row:first-child {
  border-top: 0;
}
.monitoring-service-row span,
.monitoring-service-row time {
  overflow: hidden;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monitoring-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 99px;
  background: rgb(var(--v-theme-warning));
  box-shadow: 0 0 0 4px rgba(var(--v-theme-warning), 0.12);
}
.monitoring-status-dot.is-healthy {
  background: rgb(var(--v-theme-success));
  box-shadow: 0 0 0 4px rgba(var(--v-theme-success), 0.12);
}
.monitoring-status-dot.is-critical {
  background: rgb(var(--v-theme-error));
  box-shadow: 0 0 0 4px rgba(var(--v-theme-error), 0.12);
}
.monitoring-incident-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 7px 0;
  border: 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.monitoring-incident-row:first-child {
  border-top: 0;
}
.monitoring-incident-row span {
  display: grid;
  min-width: 0;
}
.monitoring-incident-row small,
.monitoring-incident-row time {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
}
.monitoring-service-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.monitoring-service-card {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 14px;
}
.monitoring-service-card div {
  display: grid;
}
.monitoring-service-card small,
.monitoring-service-card time {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
}
.monitoring-service-card time {
  grid-column: 2;
}
.monitoring-slot-stack {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}
.monitoring-table {
  min-width: 620px;
  background: transparent !important;
}
.monitoring-table__secondary {
  display: block;
  max-width: 440px;
  overflow: hidden;
  color: rgb(var(--v-theme-on-surface-variant));
  text-overflow: ellipsis;
  white-space: nowrap;
}
.monitoring-rules {
  display: grid;
  gap: 2px;
  max-height: 70vh;
  overflow: auto;
}
.monitoring-rule-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.monitoring-rule-row span {
  display: grid;
}
.monitoring-rule-row small {
  color: rgb(var(--v-theme-on-surface-variant));
}
.monitoring-diagnosis {
  display: grid;
  grid-template-columns: minmax(100px, 0.4fr) 1fr;
  gap: 8px 14px;
  margin: 0;
}
.monitoring-diagnosis dt {
  color: rgb(var(--v-theme-on-surface-variant));
}
.monitoring-diagnosis dd {
  margin: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 1100px) {
  .monitoring-kpis,
  .monitoring-service-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .monitoring-commandbar,
  .monitoring-commandbar__controls {
    align-items: stretch;
    flex-direction: column;
  }
  .monitoring-commandbar__controls > :not(.v-btn) {
    width: 100%;
  }
  .monitoring-kpis,
  .monitoring-overview-grid,
  .monitoring-incident-grid,
  .monitoring-usage-grid,
  .monitoring-chart-grid,
  .monitoring-service-cards {
    grid-template-columns: 1fr;
  }
  .monitoring-service-row {
    grid-template-columns: 12px 1fr auto;
  }
  .monitoring-service-row > span:not(.monitoring-status-dot) {
    grid-column: 2 / -1;
  }
}
</style>
