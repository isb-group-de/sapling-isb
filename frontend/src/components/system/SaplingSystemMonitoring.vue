<template>
  <section class="monitoring-console glass-panel">
    <SaplingMonitoringHeader
      v-model:tab="tab"
      v-model:environment="selectedEnvironment"
      v-model:range="rangePreset"
      :system-title="systemTitle"
      :system-subtitle="systemSubtitle"
      :system-ready="systemReady"
      :platform="platform"
      :architecture="architecture"
      :version="version"
      :server-time="serverTime"
      :last-updated-label="lastUpdatedLabel"
      :collector-enabled="collectorEnabled"
      :maximum-gap-seconds="maximumGapSeconds"
      :open-incident-count="openIncidents.length"
      :environment-options="environmentOptions"
      :range-options="rangeOptions"
      :refreshing="loading || systemRefreshing"
      @refresh="refreshWorkspace"
    />

    <div class="monitoring-console__content">
      <v-window v-model="tab" class="monitoring-window">
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

        <v-window-item class="monitoring-window-item" value="incidents">
          <div class="monitoring-incident-grid">
            <article class="monitoring-panel">
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
                    <strong>{{ metricLabel(incident.rule.metricKey) }}</strong>
                    <small
                      >{{ stateLabel(incident.state) }} ·
                      {{ humanLabel(incident.incidentType || 'threshold') }}</small
                    >
                  </span>
                  <time>{{ dateTime(incident.lastSeenAt) }}</time>
                </button>
              </div>
            </article>

            <article class="monitoring-panel">
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
            <article class="monitoring-panel">
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
                    <td>{{ checkLabel(check.checkKey) }}</td>
                    <td>
                      <v-chip :color="statusColor(check.status)" size="x-small">{{
                        stateLabel(check.status)
                      }}</v-chip>
                    </td>
                    <td>{{ number(check.durationMs) }} ms</td>
                    <td>{{ dateTime(check.completedAt) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </article>
            <article class="monitoring-panel">
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
                    <td>{{ remediationLabel(execution.actionKey) }}</td>
                    <td>{{ stateLabel(execution.mode) }}</td>
                    <td>
                      <v-chip
                        :color="execution.state === 'succeeded' ? 'success' : 'warning'"
                        size="x-small"
                        >{{ stateLabel(execution.state) }}</v-chip
                      >
                    </td>
                    <td>{{ dateTime(execution.startedAt) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </article>
          </div>
        </v-window-item>

        <v-window-item class="monitoring-window-item" value="services">
          <div class="monitoring-service-cards">
            <article
              v-for="service in serviceCards"
              :key="service.service"
              class="monitoring-service-card"
            >
              <span class="monitoring-status-dot" :class="`is-${service.status}`" />
              <div>
                <strong>{{ serviceLabel(service.service) }}</strong
                ><small>{{ service.summary || `${number(service.durationMs)} ms` }}</small>
              </div>
              <time>{{ dateTime(service.lastCheckedAt) }}</time>
            </article>
          </div>
          <div class="monitoring-chart-grid monitoring-chart-grid--capacity">
            <MonitoringChart
              :eyebrow="$t('system.monitoringStorageDatabase')"
              :title="$t('system.monitoringDatabaseSize')"
              :points="metricPoints(['database.sizeBytes'])"
              value-format="bytes"
            />
            <MonitoringChart
              :eyebrow="$t('system.monitoringStorage')"
              :title="$t('system.monitoringDocumentStorage')"
              :points="metricPoints(['documentStorage.sizeBytes'])"
              value-format="bytes"
            />
            <MonitoringChart
              class="monitoring-chart--wide"
              :eyebrow="$t('system.monitoringInfrastructure')"
              :title="$t('system.monitoringNetworkThroughput')"
              :points="metricPoints(['network.rxBytesPerSecond', 'network.txBytesPerSecond'])"
              value-format="bytesPerSecond"
            />
          </div>
          <div class="monitoring-slot-stack">
            <slot name="database" />
            <slot name="storage" />
            <slot name="network" />
            <slot name="system" />
          </div>
        </v-window-item>

        <v-window-item class="monitoring-window-item" value="performance">
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
          <article class="monitoring-panel">
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

        <v-window-item class="monitoring-window-item" value="usage">
          <div class="monitoring-presence-summary">
            <article
              v-for="presence in presenceSummary"
              :key="presence.key"
              class="monitoring-presence-card"
            >
              <span class="monitoring-presence-card__icon" :class="`is-${presence.key}`">
                <v-icon :icon="presence.icon" />
              </span>
              <div>
                <strong>{{ presence.value }}</strong>
                <span>{{ presence.label }}</span>
              </div>
            </article>
          </div>
          <div class="monitoring-usage-grid">
            <article class="monitoring-panel monitoring-panel--users">
              <div class="monitoring-panel__header">
                <h3>{{ $t('system.monitoringUsers') }}</h3>
                <span>{{ usersTotal }}</span>
              </div>
              <v-table class="sapling-table monitoring-table" density="compact">
                <thead>
                  <tr>
                    <th>{{ $t('system.monitoringUser') }}</th>
                    <th>{{ $t('system.monitoringPresence') }}</th>
                    <th>{{ $t('system.monitoringValidSessions') }}</th>
                    <th>{{ $t('system.monitoringLastSeen') }}</th>
                    <th>{{ $t('system.monitoringLastLogin') }}</th>
                    <th>{{ $t('system.monitoringRequests') }}</th>
                    <th>{{ $t('system.monitoringErrors') }}</th>
                    <th>{{ $t('system.monitoringTokens') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in users" :key="user.handle">
                    <td>{{ [user.firstName, user.lastName].filter(Boolean).join(' ') }}</td>
                    <td>
                      <v-chip :color="userPresenceColor(user)" size="x-small" variant="tonal">
                        {{ userPresenceLabel(user) }}
                      </v-chip>
                    </td>
                    <td>{{ number(user.sessionCount) }}</td>
                    <td>{{ dateTime(user.lastActivityAt) }}</td>
                    <td>{{ dateTime(user.lastLoginAt) }}</td>
                    <td>{{ number(user.requests) }}</td>
                    <td>{{ number(user.errors) }}</td>
                    <td>{{ compactNumber(user.tokens) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </article>
            <article class="monitoring-panel monitoring-panel--ai">
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
    </div>

    <SaplingDialog v-model="rulesOpen" size="lg">
      <SaplingDialogCard class="sapling-dialog-compact-card" :close="closeRules">
        <SaplingDialogShell body-class="monitoring-dialog__body">
          <template #hero>
            <SaplingDialogHero
              :eyebrow="$t('system.monitoringIncidentsArea')"
              :title="$t('system.monitoringAlertRules')"
            />
          </template>
          <template #body>
            <div class="monitoring-rules">
              <div v-for="rule in rules" :key="rule.handle" class="monitoring-rule-row">
                <SaplingSwitch
                  v-model="rule.isActive"
                  hide-details
                  density="compact"
                  @update:model-value="updateRule(rule)"
                />
                <span>
                  <strong>{{ metricLabel(rule.metricKey) }}</strong>
                  <small>{{ ruleCondition(rule) }}</small>
                </span>
                <v-chip v-if="rule.shadowMode" size="x-small">Shadow</v-chip>
                <v-chip :color="rule.severity === 'critical' ? 'error' : 'warning'" size="x-small">
                  {{ stateLabel(rule.severity) }}
                </v-chip>
              </div>
            </div>
          </template>
          <template #actions>
            <SaplingActionClose :close="closeRules" />
          </template>
        </SaplingDialogShell>
      </SaplingDialogCard>
    </SaplingDialog>

    <SaplingDialog v-model="incidentOpen" size="md" @after-leave="closeIncident">
      <SaplingDialogCard
        v-if="selectedIncident"
        class="sapling-dialog-compact-card"
        :close="closeIncidentDialog"
      >
        <SaplingDialogShell body-class="monitoring-dialog__body">
          <template #hero>
            <SaplingDialogHero
              :eyebrow="`${stateLabel(selectedIncident.state)} · ${stateLabel(selectedIncident.severity)}`"
              :title="metricLabel(selectedIncident.rule.metricKey)"
              :stats="incidentStats"
              :stats-columns="2"
              stats-layout="compact"
            />
          </template>
          <template #body>
            <dl class="monitoring-diagnosis">
              <template v-for="(value, key) in selectedIncident.diagnosis || {}" :key="key">
                <dt>{{ humanLabel(String(key)) }}</dt>
                <dd>{{ value }}</dd>
              </template>
            </dl>
          </template>
          <template #actions>
            <SaplingActionBar>
              <template #leading>
                <v-btn variant="text" prepend-icon="mdi-close" @click="closeIncidentDialog">
                  {{ $t('global.close') }}
                </v-btn>
              </template>
              <template #trailing>
                <v-btn
                  v-if="
                    selectedIncident.state === 'open' && selectedIncident.rule.remediationActionKey
                  "
                  color="primary"
                  prepend-icon="mdi-auto-fix"
                  variant="tonal"
                  :loading="remediationPending"
                  @click="remediateSelectedIncident"
                >
                  {{ $t('system.monitoringExecuteRemediation') }}
                </v-btn>
              </template>
            </SaplingActionBar>
          </template>
        </SaplingDialogShell>
      </SaplingDialogCard>
    </SaplingDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingSystemMetricCard from './SaplingSystemMetricCard.vue'
import MonitoringChart from './SaplingMonitoringChart.vue'
import SaplingMonitoringHeader from './SaplingMonitoringHeader.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import { useSaplingSystemMonitoring } from '@/composables/system/useSaplingSystemMonitoring'
import type { MonitoringAlertRule, MonitoringUser } from '@/entity/system'
import {
  monitoringCheckLabel,
  monitoringMetricLabel,
  monitoringRemediationLabel,
  monitoringServiceLabel,
  monitoringStateLabel,
} from './systemMonitoringLabels'
import { maximumActiveCollectorGapSeconds } from './systemMonitoringStatus'

defineProps<{
  systemTitle: string
  systemSubtitle: string
  systemReady: boolean
  platform: string
  architecture: string
  version: string
  serverTime: string
  systemRefreshing: boolean
}>()
const emit = defineEmits<{ refreshSystem: [] }>()

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
const maximumGapSeconds = computed(() => maximumActiveCollectorGapSeconds(collectorStatus.value))
const lastUpdatedLabel = computed(() =>
  summary.value?.lastSampleAt ? dateTime(summary.value.lastSampleAt) : t('global.notAvailable'),
)
const presenceSummary = computed(() => {
  const online = summary.value?.users.onlineUsers ?? 0
  const signedIn = summary.value?.users.usersWithSessions ?? 0
  return [
    {
      key: 'online',
      icon: 'mdi-circle-medium',
      label: t('system.monitoringOnline'),
      value: number(online),
    },
    {
      key: 'session',
      icon: 'mdi-account-clock-outline',
      label: t('system.monitoringSession'),
      value: number(Math.max(signedIn - online, 0)),
    },
    {
      key: 'offline',
      icon: 'mdi-account-off-outline',
      label: t('system.monitoringOffline'),
      value: number(Math.max(usersTotal.value - signedIn, 0)),
    },
  ]
})
const incidentStats = computed(() => {
  const incident = selectedIncident.value
  if (!incident) return []
  return [
    { label: t('system.monitoringLastSeen'), value: dateTime(incident.lastSeenAt) },
    {
      label: locale.value.toLowerCase().startsWith('de') ? 'Schwellenwert' : 'Threshold',
      value: number(incident.threshold),
    },
  ]
})

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
  return monitoringServiceLabel(locale.value, value)
}

function checkLabel(value: string): string {
  return monitoringCheckLabel(locale.value, value)
}

function metricLabel(value: string): string {
  return monitoringMetricLabel(t, locale.value, value)
}

function remediationLabel(value: string): string {
  return monitoringRemediationLabel(locale.value, value)
}

function stateLabel(value: string): string {
  return monitoringStateLabel(locale.value, value)
}

function humanLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

function ruleCondition(rule: MonitoringAlertRule): string {
  const comparator = { gt: '>', gte: '≥', lt: '<', lte: '≤' }[rule.comparator]
  return `${comparator} ${number(rule.threshold)} · ${number(rule.windowSeconds / 60)} min · n ≥ ${number(rule.minimumCount)}`
}

function statusColor(value: string): string {
  return value === 'healthy' ? 'success' : value === 'critical' ? 'error' : 'warning'
}

function userPresenceLabel(user: MonitoringUser): string {
  if (user.online) return t('system.monitoringOnline')
  if (user.sessionCount > 0) return t('system.monitoringSession')
  return t('system.monitoringOffline')
}

function userPresenceColor(user: MonitoringUser): string {
  if (user.online) return 'success'
  if (user.sessionCount > 0) return 'info'
  return 'default'
}

function refreshWorkspace(): void {
  void loadAll()
  emit('refreshSystem')
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

function closeRules(): void {
  rulesOpen.value = false
}

function closeIncidentDialog(): void {
  incidentOpen.value = false
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
