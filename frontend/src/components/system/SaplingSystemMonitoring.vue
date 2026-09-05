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
        <SaplingMonitoringOverviewTab
          :summary="summary"
          :loading="loading"
          :open-incidents="openIncidents"
          :service-cards="serviceCards"
          :healthy-service-count="healthyServiceCount"
          :number="number"
          :compact-number="compactNumber"
          :percent="percent"
          :date-time="dateTime"
          :service-label="serviceLabel"
          :metric-label="metricLabel"
          :metric-points="metricPoints"
          @show-incidents="tab = 'incidents'"
          @open-incident="openIncident"
        />

        <SaplingMonitoringIncidentsTab
          :incidents="incidents"
          :error-groups="errorGroups"
          :checks="checks"
          :remediations="remediations"
          :number="number"
          :date-time="dateTime"
          :metric-label="metricLabel"
          :check-label="checkLabel"
          :state-label="stateLabel"
          :incident-type-label="incidentTypeLabel"
          :remediation-label="remediationLabel"
          :status-color="statusColor"
          @open-rules="rulesOpen = true"
          @open-incident="openIncident"
        />

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
            <SaplingDataTable
              class="sapling-table monitoring-table"
              :items="requestGroups"
              :columns="[
                { key: 'c0', title: $t('system.monitoringCategory'), value: (row) => row.group },
                {
                  key: 'c1',
                  title: $t('system.monitoringRequests'),
                  value: (row) => row.requestCount,
                },
                {
                  key: 'c2',
                  title: $t('system.monitoringErrors'),
                  value: (row) => row.serverErrorCount,
                },
                {
                  key: 'c3',
                  title: $t('system.monitoringTraffic'),
                  value: (row) => Number(row.requestBytes ?? 0) + Number(row.responseBytes ?? 0),
                },
                { key: 'c4', title: 'p50', value: (row) => row.durationP50Ms },
                { key: 'c5', title: 'p95', value: (row) => row.durationP95Ms },
                { key: 'c6', title: 'p99', value: (row) => row.durationP99Ms },
              ]"
            >
              <template #row="{ item: row }">
                <tr>
                  <td>{{ row.group }}</td>
                  <td>{{ number(row.requestCount) }}</td>
                  <td>{{ number(row.serverErrorCount) }}</td>
                  <td>
                    {{ bytes(Number(row.requestBytes ?? 0) + Number(row.responseBytes ?? 0)) }}
                  </td>
                  <td>{{ number(row.durationP50Ms) }} ms</td>
                  <td>{{ number(row.durationP95Ms) }} ms</td>
                  <td>{{ number(row.durationP99Ms) }} ms</td>
                </tr>
              </template>
            </SaplingDataTable>
          </article>
        </v-window-item>

        <SaplingMonitoringUsageTab
          :users="users"
          :users-total="usersTotal"
          :ai-groups="aiGroups"
          :summary="summary"
          :number="number"
          :bytes="bytes"
          :compact-number="compactNumber"
          :date-time="dateTime"
        />
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

    <SaplingDialog v-model="incidentOpen" size="lg" @after-leave="closeIncident">
      <SaplingDialogCard
        v-if="selectedIncident"
        class="sapling-dialog-compact-card monitoring-incident-dialog"
        :close="closeIncidentDialog"
      >
        <SaplingDialogShell body-class="monitoring-dialog__body">
          <template #hero>
            <SaplingDialogHero
              :eyebrow="incidentEyebrow"
              :title="metricLabel(selectedIncident.rule.metricKey)"
              :stats="incidentStats"
              :stats-columns="2"
              stats-layout="compact"
            />
          </template>
          <template #body>
            <div class="monitoring-incident-detail">
              <section class="monitoring-incident-detail__section">
                <header class="monitoring-incident-detail__header">
                  <span class="monitoring-incident-detail__icon">
                    <v-icon icon="mdi-timeline-clock-outline" />
                  </span>
                  <span>
                    <strong>{{ incidentText('timeline') }}</strong>
                    <small>{{ incidentText('timelineDescription') }}</small>
                  </span>
                </header>
                <dl
                  class="monitoring-incident-detail__grid monitoring-incident-detail__grid--timeline"
                >
                  <div v-for="item in incidentTimeline" :key="item.label">
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                  </div>
                </dl>
              </section>

              <section class="monitoring-incident-detail__section">
                <header class="monitoring-incident-detail__header">
                  <span class="monitoring-incident-detail__icon">
                    <v-icon icon="mdi-clipboard-text-search-outline" />
                  </span>
                  <span>
                    <strong>{{ incidentText('evaluation') }}</strong>
                    <small>{{ incidentText('evaluationDescription') }}</small>
                  </span>
                </header>
                <dl class="monitoring-incident-detail__grid">
                  <div v-for="item in incidentDiagnosis" :key="item.key">
                    <dt>{{ item.label }}</dt>
                    <dd :class="{ 'monitoring-incident-detail__code': item.code }">
                      {{ item.value }}
                    </dd>
                    <small>{{ item.description }}</small>
                  </div>
                </dl>
              </section>
            </div>
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
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMonitoringFormatters } from './useMonitoringFormatters'
import MonitoringChart from './SaplingMonitoringChart.vue'
import SaplingMonitoringUsageTab from './SaplingMonitoringUsageTab.vue'
import SaplingMonitoringHeader from './SaplingMonitoringHeader.vue'
import SaplingMonitoringIncidentsTab from './SaplingMonitoringIncidentsTab.vue'
import SaplingMonitoringOverviewTab from './SaplingMonitoringOverviewTab.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingDialogHero from '@/components/common/SaplingDialogHero.vue'
import SaplingDialogShell from '@/components/common/SaplingDialogShell.vue'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingActionBar from '@/components/actions/SaplingActionBar.vue'
import SaplingActionClose from '@/components/actions/SaplingActionClose.vue'
import { useSaplingSystemMonitoring } from '@/composables/system/useSaplingSystemMonitoring'
import type { MonitoringAlertRule } from '@/entity/system'
import {
  monitoringCheckLabel,
  monitoringIncidentText,
  monitoringIncidentTypeLabel,
  monitoringMetricLabel,
  monitoringMetricValue,
  monitoringRemediationLabel,
  monitoringServiceLabel,
  monitoringStateLabel,
} from './systemMonitoringLabels'
import { maximumActiveCollectorGapSeconds } from './systemMonitoringStatus'
import { monitoringStatusColor } from './systemMonitoringStatus'

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
const { t, locale } = useI18n()
const { number, bytes, compactNumber, percent, dateTime } = useMonitoringFormatters()
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
const incidentStats = computed(() => {
  const incident = selectedIncident.value
  if (!incident) return []
  return [
    {
      label: t('system.monitoringIncidentObserved'),
      value: monitoringMetricValue(locale.value, incident.rule.metricKey, incident.observedValue),
    },
    {
      label: incidentText('triggerThreshold'),
      value: `${comparatorSymbol(incident.rule.comparator)} ${monitoringMetricValue(locale.value, incident.rule.metricKey, incident.threshold)}`,
    },
  ]
})
const incidentEyebrow = computed(() => {
  const incident = selectedIncident.value
  if (!incident) return ''
  return [
    stateLabel(incident.state),
    stateLabel(incident.severity),
    monitoringIncidentTypeLabel(locale.value, incident.incidentType || 'threshold'),
  ].join(' · ')
})
const incidentTimeline = computed(() => {
  const incident = selectedIncident.value
  if (!incident) return []
  const items = [
    { label: incidentText('firstSeen'), value: dateTime(incident.firstSeenAt) },
    { label: t('system.monitoringLastSeen'), value: dateTime(incident.lastSeenAt) },
    {
      label: t('system.monitoringDuration'),
      value: `${number(incident.rule.windowSeconds / 60)} min`,
    },
  ]
  if (incident.resolvedAt) {
    items.push({ label: stateLabel('resolved'), value: dateTime(incident.resolvedAt) })
  }
  return items
})
const incidentDiagnosis = computed(() => {
  const incident = selectedIncident.value
  if (!incident) return []
  const diagnosis = incident.diagnosis || {}
  const dimension = diagnosis.dimension ?? incident.dimensionKey
  const sampleCount = diagnosis.count
  const metricKey = diagnosis.metricKey ?? incident.rule.metricKey
  return [
    {
      key: 'scope',
      label: incidentText('scope'),
      value:
        dimension == null || String(dimension).trim() === ''
          ? incidentText('globalScope')
          : String(dimension),
      description: incidentText('scopeDescription'),
      code: false,
    },
    {
      key: 'samples',
      label: incidentText('samples'),
      value: sampleCount == null ? t('global.notAvailable') : number(sampleCount),
      description: incidentText('samplesDescription'),
      code: false,
    },
    {
      key: 'metricKey',
      label: incidentText('metricKey'),
      value: String(metricKey),
      description: incidentText('metricKeyDescription'),
      code: true,
    },
  ]
})

watch(tab, (area) => {
  void router.replace({ query: { ...route.query, area } })
})

function metricPoints(keys: string[]) {
  return series.value.filter((point) => keys.includes(point.metricKey))
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

function incidentTypeLabel(value: string): string {
  return monitoringIncidentTypeLabel(locale.value, value)
}

function incidentText(key: Parameters<typeof monitoringIncidentText>[2]): string {
  return monitoringIncidentText(t, locale.value, key)
}

function comparatorSymbol(comparator: MonitoringAlertRule['comparator']): string {
  return { gt: '>', gte: '≥', lt: '<', lte: '≤' }[comparator]
}

function ruleCondition(rule: MonitoringAlertRule): string {
  return `${comparatorSymbol(rule.comparator)} ${monitoringMetricValue(locale.value, rule.metricKey, rule.threshold)} · ${number(rule.windowSeconds / 60)} min · n ≥ ${number(rule.minimumCount)}`
}

function statusColor(value: string): string {
  return monitoringStatusColor(value)
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
