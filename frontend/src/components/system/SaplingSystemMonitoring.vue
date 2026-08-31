<template>
  <section class="sapling-monitoring">
    <div class="sapling-monitoring__toolbar glass-panel sapling-data-card">
      <div class="sapling-monitoring__heading">
        <div class="sapling-monitoring__heading-icon"><v-icon icon="mdi-pulse" /></div>
        <div>
          <p class="sapling-eyebrow">{{ $t('system.monitoringEyebrow') }}</p>
          <h2>{{ $t('system.monitoringTitle') }}</h2>
          <p class="sapling-muted-copy">
            {{ $t('system.monitoringSubtitle') }}
            <span v-if="summary?.lastSampleAt">· {{ formatDate(summary.lastSampleAt) }}</span>
          </p>
        </div>
      </div>
      <div class="sapling-monitoring__actions">
        <v-select
          v-model="rangePreset"
          :items="rangeItems"
          item-title="title"
          item-value="value"
          density="compact"
          hide-details
          variant="outlined"
          :label="$t('system.monitoringRange')"
        />
        <SaplingTextField
          v-if="rangePreset === 'custom'"
          v-model="customFrom"
          type="datetime-local"
          density="compact"
          hide-details
          variant="outlined"
          :label="$t('system.monitoringFrom')"
        />
        <SaplingTextField
          v-if="rangePreset === 'custom'"
          v-model="customTo"
          type="datetime-local"
          density="compact"
          hide-details
          variant="outlined"
          :label="$t('system.monitoringTo')"
        />
        <v-btn
          icon="mdi-refresh"
          color="primary"
          variant="tonal"
          :loading="loading"
          :title="$t('system.refresh')"
          @click="loadAll"
        />
      </div>
    </div>

    <v-alert v-if="collectorEnabled === false" type="info" variant="tonal">
      {{ $t('system.monitoringDisabled') }}
    </v-alert>
    <v-alert v-else-if="maximumGapSeconds > 60" type="warning" variant="tonal">
      {{ $t('system.monitoringGapDetected', { seconds: number(maximumGapSeconds) }) }}
    </v-alert>

    <div class="sapling-monitoring__navigation glass-panel sapling-data-card">
      <v-tabs v-model="tab" show-arrows center-active>
        <v-tab prepend-icon="mdi-view-dashboard-outline" value="overview">{{
          $t('system.monitoringOverview')
        }}</v-tab>
        <v-tab prepend-icon="mdi-speedometer" value="performance">{{
          $t('system.performance')
        }}</v-tab>
        <v-tab prepend-icon="mdi-harddisk" value="storage">{{
          $t('system.monitoringStorage')
        }}</v-tab>
        <v-tab prepend-icon="mdi-lan" value="network">{{ $t('system.network') }}</v-tab>
        <v-tab prepend-icon="mdi-database-outline" value="database">{{
          $t('system.database')
        }}</v-tab>
        <v-tab prepend-icon="mdi-swap-horizontal" value="requests">{{
          $t('system.monitoringRequests')
        }}</v-tab>
        <v-tab prepend-icon="mdi-account-multiple-outline" value="users">{{
          $t('system.monitoringUsers')
        }}</v-tab>
        <v-tab prepend-icon="mdi-creation-outline" value="ai">{{
          $t('system.monitoringAiTokens')
        }}</v-tab>
        <v-tab prepend-icon="mdi-alert-outline" value="alerts">
          {{ $t('system.monitoringAlerts') }}
          <v-badge
            v-if="openIncidents.length"
            class="ml-2"
            color="error"
            :content="openIncidents.length"
            inline
          />
        </v-tab>
        <v-tab prepend-icon="mdi-server-outline" value="system">{{
          $t('system.monitoringSystemInfo')
        }}</v-tab>
      </v-tabs>
    </div>

    <v-window v-model="tab" class="sapling-monitoring__window">
      <v-window-item value="overview">
        <div v-if="tab === 'overview'" class="sapling-monitoring__metrics">
          <SaplingSystemMetricCard
            icon="mdi-heart-pulse"
            icon-class="sapling-system-metric__icon--state"
            :label="$t('system.monitoringHealth')"
            :value="$t(`system.monitoringHealth_${summary?.health ?? 'unknown'}`)"
            :detail="`${number(summary?.incidents.openCount)} ${$t('system.monitoringOpenIncidents')}`"
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
            icon="mdi-swap-horizontal"
            icon-class="sapling-system-metric__icon--network"
            :label="$t('system.monitoringRequests')"
            :value="number(summary?.requests.requestCount)"
            :detail="`p95 ${number(summary?.requests.durationP95Ms)} ms · ${percent(summary?.requests.serverErrorRate)} ${$t('system.monitoringServerErrors')}`"
            :value-loading="loading && !summary"
          />
          <SaplingSystemMetricCard
            icon="mdi-account-multiple-check"
            icon-class="sapling-system-metric__icon--state"
            :label="$t('system.monitoringOnlineUsers')"
            :value="number(summary?.users.onlineUsers)"
            :detail="`${number(summary?.users.usersWithSessions)} ${$t('system.monitoringValidSessions')}`"
            :value-loading="loading && !summary"
          />
          <SaplingSystemMetricCard
            icon="mdi-creation-outline"
            icon-class="sapling-system-metric__icon--memory"
            :label="$t('system.monitoringTokens')"
            :value="compactNumber(summary?.ai.totalTokens)"
            :detail="`${number(summary?.ai.callCount)} ${$t('system.monitoringAiCalls')}`"
            :value-loading="loading && !summary"
          />
        </div>
        <div
          v-if="tab === 'overview'"
          class="sapling-monitoring__chart-grid sapling-monitoring__chart-grid--spaced"
        >
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
      </v-window-item>

      <v-window-item value="performance">
        <div v-if="tab === 'performance'" class="sapling-monitoring__section-stack">
          <slot name="performance" />
          <div class="sapling-monitoring__chart-grid">
            <MonitoringChart
              :title="$t('system.monitoringCpuMemory')"
              :points="metricPoints(['host.cpu.percent', 'host.memory.usedPercent'])"
              unit=" %"
            />
            <MonitoringChart
              :title="$t('system.monitoringProcessMemory')"
              :points="metricPoints(['process.memory.rssBytes', 'process.memory.heapUsedBytes'])"
              unit=" B"
            />
            <MonitoringChart
              :title="$t('system.monitoringEventLoop')"
              :points="metricPoints(['process.eventLoop.p95Ms'])"
              unit=" ms"
            />
          </div>
        </div>
      </v-window-item>

      <v-window-item value="storage">
        <div v-if="tab === 'storage'" class="sapling-monitoring__section-stack">
          <slot name="storage" />
          <div class="sapling-monitoring__chart-grid">
            <MonitoringChart
              :title="$t('system.monitoringFilesystemUsage')"
              :points="metricPoints(['filesystem.usedPercent'])"
              unit=" %"
            />
            <MonitoringChart
              :title="$t('system.monitoringDocumentStorage')"
              :points="metricPoints(['documentStorage.sizeBytes'])"
              unit=" B"
            />
          </div>
        </div>
      </v-window-item>

      <v-window-item value="network">
        <div v-if="tab === 'network'" class="sapling-monitoring__section-stack">
          <slot name="network" />
          <MonitoringChart
            :title="$t('system.monitoringNetworkThroughput')"
            :points="metricPoints(['network.rxBytesPerSecond', 'network.txBytesPerSecond'])"
            unit=" B/s"
          />
        </div>
      </v-window-item>

      <v-window-item value="database">
        <div v-if="tab === 'database'" class="sapling-monitoring__section-stack">
          <slot name="database" />
          <div class="sapling-monitoring__chart-grid">
            <MonitoringChart
              :title="$t('system.monitoringDatabaseConnections')"
              :points="metricPoints(['database.connectionUsedPercent'])"
              unit=" %"
            />
            <MonitoringChart
              :title="$t('system.monitoringDatabaseSize')"
              :points="metricPoints(['database.sizeBytes'])"
              unit=" B"
            />
          </div>
        </div>
      </v-window-item>

      <v-window-item value="requests">
        <MonitoringTablePanel
          eyebrow="HTTP"
          :title="$t('system.monitoringRequestAnalysis')"
          :count="requestGroups.length"
        >
          <v-table class="sapling-table sapling-monitoring__table" density="comfortable" hover>
            <thead>
              <tr>
                <th>{{ $t('system.monitoringCategory') }}</th>
                <th>{{ $t('system.monitoringRequests') }}</th>
                <th>4xx</th>
                <th>5xx</th>
                <th>{{ $t('system.monitoringTraffic') }}</th>
                <th>{{ $t('system.monitoringAverage') }}</th>
                <th>p95</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in requestGroups" :key="String(group.group)">
                <td>
                  <v-chip size="small" variant="tonal">{{ group.group }}</v-chip>
                </td>
                <td>{{ number(group.requestCount) }}</td>
                <td>{{ number(group.clientErrorCount) }}</td>
                <td>{{ number(group.serverErrorCount) }}</td>
                <td>
                  {{ bytes(Number(group.requestBytes ?? 0) + Number(group.responseBytes ?? 0)) }}
                </td>
                <td>{{ durationAverage(group) }}</td>
                <td>{{ number(group.durationP95Ms) }} ms</td>
              </tr>
            </tbody>
          </v-table>
        </MonitoringTablePanel>
      </v-window-item>

      <v-window-item value="users">
        <MonitoringTablePanel
          :eyebrow="$t('system.monitoringPresence')"
          :title="$t('system.monitoringUserAnalysis')"
          :count="usersTotal"
        >
          <v-table class="sapling-table sapling-monitoring__table" density="comfortable" hover>
            <thead>
              <tr>
                <th>{{ $t('system.monitoringUser') }}</th>
                <th>{{ $t('system.monitoringPresence') }}</th>
                <th>{{ $t('system.monitoringLastLogin') }}</th>
                <th>{{ $t('system.monitoringRequests') }}</th>
                <th>{{ $t('system.monitoringErrors') }}</th>
                <th>{{ $t('system.monitoringTraffic') }}</th>
                <th>{{ $t('system.monitoringTokens') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in users"
                :key="user.handle"
                class="sapling-monitoring__clickable"
                @click="openUser(user.handle)"
              >
                <td>
                  <div class="sapling-monitoring__user-cell">
                    <v-avatar size="32" color="primary" variant="tonal">{{
                      userInitials(user)
                    }}</v-avatar
                    ><strong>{{
                      [user.firstName, user.lastName].filter(Boolean).join(' ')
                    }}</strong>
                  </div>
                </td>
                <td>
                  <v-chip
                    size="small"
                    :color="user.online ? 'success' : user.sessionCount ? 'info' : undefined"
                    variant="tonal"
                    >{{ presenceLabel(user) }}</v-chip
                  >
                </td>
                <td>{{ formatDate(user.lastLoginAt) }}</td>
                <td>{{ number(user.requests) }}</td>
                <td>{{ number(user.errors) }}</td>
                <td>{{ bytes(user.traffic) }}</td>
                <td>{{ compactNumber(user.tokens) }}</td>
              </tr>
            </tbody>
          </v-table>
          <v-empty-state
            v-if="users.length === 0"
            icon="mdi-account-clock-outline"
            :text="$t('system.monitoringNoData')"
          />
          <v-pagination
            v-if="usersTotal > MONITORING_USERS_PAGE_SIZE"
            v-model="usersPage"
            :length="Math.ceil(usersTotal / MONITORING_USERS_PAGE_SIZE)"
            class="mt-4"
          />
        </MonitoringTablePanel>
      </v-window-item>

      <v-window-item value="ai">
        <MonitoringTablePanel
          :eyebrow="$t('system.monitoringAiTokens')"
          :title="$t('system.monitoringAiAnalysis')"
          :count="aiGroups.length"
        >
          <v-table class="sapling-table sapling-monitoring__table" density="comfortable" hover>
            <thead>
              <tr>
                <th>{{ $t('system.monitoringProvider') }}</th>
                <th>{{ $t('system.monitoringAiCalls') }}</th>
                <th>{{ $t('system.monitoringInputTokens') }}</th>
                <th>{{ $t('system.monitoringOutputTokens') }}</th>
                <th>{{ $t('system.monitoringTokens') }}</th>
                <th>{{ $t('system.monitoringErrors') }}</th>
                <th>{{ $t('system.monitoringCoverage') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in aiGroups" :key="String(group.group)">
                <td>
                  <strong>{{ group.group }}</strong>
                </td>
                <td>{{ number(group.callCount) }}</td>
                <td>{{ compactNumber(group.inputTokens) }}</td>
                <td>{{ compactNumber(group.outputTokens) }}</td>
                <td>{{ compactNumber(group.totalTokens) }}</td>
                <td>{{ number(group.errorCount) }}</td>
                <td>{{ coverage(group) }}</td>
              </tr>
            </tbody>
          </v-table>
        </MonitoringTablePanel>
      </v-window-item>

      <v-window-item value="alerts">
        <div class="sapling-monitoring__alerts-grid">
          <article class="glass-panel sapling-data-card sapling-monitoring__panel">
            <div class="sapling-section-header sapling-monitoring__incident-header">
              <div>
                <p class="sapling-eyebrow">{{ $t('system.monitoringAlerts') }}</p>
                <h3>{{ $t('system.monitoringIncidents') }}</h3>
              </div>
              <v-btn-toggle v-model="incidentFilter" mandatory density="compact" variant="outlined">
                <v-btn value="open">{{ $t('system.monitoringIncidentOpen') }}</v-btn>
                <v-btn value="resolved">{{ $t('system.monitoringIncidentHistory') }}</v-btn>
              </v-btn-toggle>
            </div>
            <div class="sapling-monitoring__alert-guidance">
              <p>
                <v-icon icon="mdi-account-shield-outline" size="small" />
                {{ notificationRecipientsHint }}
              </p>
              <p>
                <v-icon icon="mdi-progress-check" size="small" />
                {{ incidentAutoResolveHint }}
              </p>
            </div>
            <v-empty-state
              v-if="filteredIncidents.length === 0"
              icon="mdi-check-circle-outline"
              :text="$t('system.monitoringNoIncidents')"
            />
            <v-list v-else class="sapling-monitoring__incident-list">
              <v-list-item
                v-for="incident in filteredIncidents"
                :key="incident.handle"
                :active="String(route.query.incident ?? '') === String(incident.handle)"
                rounded="lg"
                class="sapling-monitoring__incident-item"
              >
                <template #prepend
                  ><div
                    class="sapling-monitoring__incident-icon"
                    :class="`sapling-monitoring__incident-icon--${incident.severity}`"
                  >
                    <v-icon>mdi-alert-circle-outline</v-icon>
                  </div></template
                >
                <v-list-item-title class="sapling-monitoring__incident-title">
                  {{ alertRuleTitle(incident.rule) }}
                </v-list-item-title>
                <v-list-item-subtitle class="sapling-monitoring__incident-meta">
                  <span>
                    <v-icon icon="mdi-map-marker-radius-outline" size="x-small" />
                    {{ incident.dimensionKey || $t('system.monitoringGlobal') }}
                  </span>
                  <span>
                    {{ incidentObservedLabel }} {{ number(incident.observedValue) }} ·
                    {{ incidentThresholdLabel }} {{ number(incident.threshold) }}
                  </span>
                  <span>
                    <v-icon icon="mdi-clock-outline" size="x-small" />
                    {{ formatDate(incident.lastSeenAt) }}
                  </span>
                </v-list-item-subtitle>
                <template #append
                  ><div class="sapling-monitoring__incident-state">
                    <v-chip
                      size="small"
                      :color="
                        incident.state === 'open'
                          ? incident.severity === 'critical'
                            ? 'error'
                            : 'warning'
                          : 'success'
                      "
                      variant="tonal"
                      >{{
                        incident.state === 'open'
                          ? $t('system.monitoringIncidentOpen')
                          : $t('system.monitoringIncidentResolved')
                      }}</v-chip
                    >
                    <small v-if="incident.state === 'open' && incident.healthyEvaluations > 0">{{
                      incidentRecoveryLabel.replace('{count}', String(incident.healthyEvaluations))
                    }}</small>
                  </div></template
                >
              </v-list-item>
            </v-list>
          </article>

          <article class="glass-panel sapling-data-card sapling-monitoring__panel">
            <div class="sapling-section-header">
              <div>
                <p class="sapling-eyebrow">{{ $t('system.monitoringConfiguration') }}</p>
                <h3>{{ $t('system.monitoringAlertRules') }}</h3>
              </div>
              <v-chip size="small" variant="tonal">{{ rules.length }}</v-chip>
            </div>
            <v-expansion-panels
              variant="accordion"
              multiple
              class="sapling-monitoring__rule-groups"
            >
              <v-expansion-panel v-for="group in ruleGroups" :key="group.key">
                <v-expansion-panel-title
                  ><v-icon :icon="group.icon" class="mr-3" />{{ group.title }}<v-spacer /><v-chip
                    size="x-small"
                    variant="tonal"
                    >{{ group.rules.length }}</v-chip
                  ></v-expansion-panel-title
                >
                <v-expansion-panel-text>
                  <div
                    v-for="rule in group.rules"
                    :key="rule.handle"
                    class="sapling-monitoring__rule"
                  >
                    <SaplingSwitch
                      v-model="rule.isActive"
                      hide-details
                      color="primary"
                      @change="updateRule(rule)"
                    />
                    <div class="sapling-monitoring__rule-copy">
                      <strong>{{ alertRuleTitle(rule) }}</strong
                      ><span>{{ monitoringMetricLabel(t, locale, rule.metricKey) }}</span>
                    </div>
                    <SaplingTextField
                      v-model.number="rule.threshold"
                      type="number"
                      density="compact"
                      hide-details
                      variant="outlined"
                      @change="updateRule(rule)"
                    />
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </article>
        </div>
      </v-window-item>

      <v-window-item value="system"><slot name="system" /></v-window-item>
    </v-window>

    <SaplingDialog v-model="userDialog" size="lg">
      <v-card class="sapling-monitoring__user-dialog">
        <v-card-title class="sapling-monitoring__dialog-title">
          <div>
            <p class="sapling-eyebrow">{{ $t('system.monitoringUserDetails') }}</p>
            <span>{{ selectedUserName }}</span>
          </div>
          <v-chip
            v-if="selectedUserProfile"
            :color="
              selectedUserProfile.online
                ? 'success'
                : selectedUserProfile.sessionCount
                  ? 'info'
                  : undefined
            "
            variant="tonal"
            >{{ selectedUserPresence }}</v-chip
          >
        </v-card-title>
        <v-card-text>
          <div v-if="selectedUserProfile" class="sapling-monitoring__detail-metrics">
            <article>
              <span>{{ $t('system.monitoringRequests') }}</span
              ><strong>{{ number(selectedUserProfile.requests) }}</strong>
            </article>
            <article>
              <span>{{ $t('system.monitoringErrors') }}</span
              ><strong>{{ number(selectedUserProfile.errors) }}</strong>
            </article>
            <article>
              <span>{{ $t('system.monitoringTraffic') }}</span
              ><strong>{{ bytes(selectedUserProfile.traffic) }}</strong>
            </article>
            <article>
              <span>{{ $t('system.monitoringLastLogin') }}</span
              ><strong>{{ formatDate(selectedUserProfile.lastLoginAt) }}</strong>
            </article>
          </div>
          <div class="sapling-monitoring__detail-sections">
            <section>
              <h3>{{ $t('system.monitoringAiTokens') }}</h3>
              <v-table class="sapling-table sapling-monitoring__table" density="compact"
                ><thead>
                  <tr>
                    <th>{{ $t('system.monitoringProvider') }}</th>
                    <th>{{ $t('system.monitoringModel') }}</th>
                    <th>{{ $t('system.monitoringAiCalls') }}</th>
                    <th>{{ $t('system.monitoringTokens') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="token in selectedUserTokens"
                    :key="`${token.provider}:${token.model}:${token.operation}`"
                  >
                    <td>{{ token.provider }}</td>
                    <td>{{ token.model || '–' }}</td>
                    <td>{{ number(token.calls) }}</td>
                    <td>{{ compactNumber(token.totalTokens) }}</td>
                  </tr>
                </tbody></v-table
              >
            </section>
            <section>
              <h3>{{ $t('system.monitoringApiTokens') }}</h3>
              <v-table class="sapling-table sapling-monitoring__table" density="compact"
                ><thead>
                  <tr>
                    <th>{{ $t('system.monitoringDescription') }}</th>
                    <th>{{ $t('system.monitoringLastUsed') }}</th>
                    <th>{{ $t('system.monitoringRequests') }}</th>
                    <th>{{ $t('system.monitoringTraffic') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="token in selectedUserApiTokens" :key="String(token.handle)">
                    <td>{{ token.description || token.tokenPrefix || '–' }}</td>
                    <td>{{ formatDate(token.lastUsedAt) }}</td>
                    <td>{{ number(token.requests) }}</td>
                    <td>{{ bytes(token.traffic) }}</td>
                  </tr>
                </tbody></v-table
              >
            </section>
          </div>
        </v-card-text>
        <v-card-actions
          ><v-spacer /><v-btn variant="tonal" @click="userDialog = false">{{
            $t('global.close')
          }}</v-btn></v-card-actions
        >
      </v-card>
    </SaplingDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SaplingSystemMetricCard from './SaplingSystemMetricCard.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingSwitch from '@/components/common/SaplingSwitch.vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import type { MonitoringAlertRule, MonitoringUser } from '@/entity/system'
import { monitoringMetricLabel } from './systemMonitoringLabels'
import {
  MONITORING_USERS_PAGE_SIZE,
  useSaplingSystemMonitoring,
} from '@/composables/system/useSaplingSystemMonitoring'

const MonitoringChart = defineAsyncComponent(() => import('./SaplingMonitoringChart.vue'))
const MonitoringTablePanel = defineComponent({
  props: { eyebrow: String, title: String, count: Number },
  setup:
    (props, { slots }) =>
    () =>
      h(
        'article',
        {
          class: 'sapling-table-root glass-panel sapling-data-card sapling-monitoring__table-panel',
        },
        [
          h('div', { class: 'sapling-section-header' }, [
            h('div', [h('p', { class: 'sapling-eyebrow' }, props.eyebrow), h('h3', props.title)]),
            h('span', { class: 'sapling-monitoring__count' }, String(props.count ?? 0)),
          ]),
          h('div', { class: 'sapling-monitoring__table-scroll' }, slots.default?.()),
        ],
      ),
})
const route = useRoute()
const { locale, t } = useI18n()
const tab = ref(route.query.incident ? 'alerts' : 'overview')
const incidentFilter = ref<'open' | 'resolved'>('open')
const userDialog = ref(false)
const monitoring = useSaplingSystemMonitoring(tab)
const {
  rangePreset,
  customFrom,
  customTo,
  usersPage,
  summary,
  series,
  requestGroups,
  users,
  aiGroups,
  incidents,
  rules,
  collectorStatus,
  usersTotal,
  selectedUser,
  loading,
  loadAll,
  loadUser,
  updateRule,
} = monitoring

const rangeItems = computed(() =>
  ['1h', '6h', '24h', '7d', '30d', '90d', 'custom'].map((value) => ({
    title: value === 'custom' ? t('system.monitoringCustomRange') : value,
    value,
  })),
)
const collectorEnabled = computed(() => {
  const collector = collectorStatus.value?.collector as Record<string, unknown> | undefined
  return typeof collector?.enabled === 'boolean' ? collector.enabled : null
})
const maximumGapSeconds = computed(() => {
  const instances = collectorStatus.value?.instances
  return Array.isArray(instances)
    ? Math.max(
        0,
        ...instances.map((item) => Number((item as Record<string, unknown>).gapSeconds ?? 0)),
      )
    : 0
})
const openIncidents = computed(() =>
  incidents.value.filter((incident) => incident.state === 'open'),
)
const filteredIncidents = computed(() =>
  incidents.value.filter((incident) => incident.state === incidentFilter.value),
)
const ruleGroups = computed(() => {
  const groups = [
    {
      key: 'performance',
      title: t('system.performance'),
      icon: 'mdi-speedometer',
      match: /^(host|process)\./,
      rules: [] as MonitoringAlertRule[],
    },
    {
      key: 'storage',
      title: t('system.monitoringStorageDatabase'),
      icon: 'mdi-database-outline',
      match: /^(filesystem|database)\./,
      rules: [] as MonitoringAlertRule[],
    },
    {
      key: 'traffic',
      title: t('system.monitoringRequests'),
      icon: 'mdi-swap-horizontal',
      match: /^(http|ai)\./,
      rules: [] as MonitoringAlertRule[],
    },
    {
      key: 'operations',
      title: t('system.monitoringOperations'),
      icon: 'mdi-cog-outline',
      match: /./,
      rules: [] as MonitoringAlertRule[],
    },
  ]
  for (const rule of rules.value)
    (groups.find((group) => group.match.test(rule.metricKey)) ?? groups[3]).rules.push(rule)
  return groups.filter((group) => group.rules.length)
})
const notificationRecipientsHint = computed(() =>
  localizedMonitoringText(
    'monitoringNotificationRecipients',
    'Benachrichtigungen erhalten ausschließlich aktive Administratoren.',
    'Notifications are sent exclusively to active administrators.',
  ),
)
const incidentAutoResolveHint = computed(() =>
  localizedMonitoringText(
    'monitoringIncidentAutoResolve',
    'Vorfälle schließen automatisch nach drei aufeinanderfolgenden gesunden Minutenprüfungen.',
    'Incidents close automatically after three consecutive healthy minute evaluations.',
  ),
)
const incidentObservedLabel = computed(() =>
  localizedMonitoringText('monitoringIncidentObserved', 'Messwert', 'Observed'),
)
const incidentThresholdLabel = computed(() =>
  localizedMonitoringText('monitoringIncidentThreshold', 'Schwelle', 'Threshold'),
)
const incidentRecoveryLabel = computed(() =>
  localizedMonitoringText('monitoringIncidentRecovery', 'Erholung {count}/3', 'Recovery {count}/3'),
)
const selectedUserProfile = computed(() =>
  selectedUser.value?.user && typeof selectedUser.value.user === 'object'
    ? (selectedUser.value.user as Record<string, unknown>)
    : null,
)
const selectedUserTokens = computed(() => arrayRecords(selectedUser.value?.tokens))
const selectedUserApiTokens = computed(() => arrayRecords(selectedUser.value?.apiTokens))
const selectedUserName = computed(() =>
  selectedUserProfile.value
    ? [selectedUserProfile.value.firstName, selectedUserProfile.value.lastName]
        .filter(Boolean)
        .join(' ')
    : t('system.monitoringUserDetails'),
)
const selectedUserPresence = computed(() =>
  selectedUserProfile.value ? presenceLabel(selectedUserProfile.value) : '',
)

watch(incidents, (items) => {
  const target = items.find((item) => String(item.handle) === String(route.query.incident ?? ''))
  if (target) incidentFilter.value = target.state
})
function metricPoints(keys: string[]) {
  return series.value.filter((point) => keys.includes(point.metricKey))
}
async function openUser(handle: number) {
  await loadUser(handle)
  userDialog.value = true
}
function number(value: unknown) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Number(value ?? 0))
}
function compactNumber(value: unknown) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  )
}
function percent(value: unknown) {
  return `${number(value)} %`
}
function bytes(value: unknown) {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(parsed) / Math.log(1024)), units.length - 1)
  return `${number(parsed / 1024 ** index)} ${units[index]}`
}
function formatDate(value?: unknown) {
  if (!value) return '–'
  const date = new Date(String(value))
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(date)
    : '–'
}
function durationAverage(group: Record<string, unknown>) {
  const count = Number(group.requestCount ?? 0)
  return `${number(count > 0 ? Number(group.durationSumMs ?? 0) / count : 0)} ms`
}
function coverage(group: Record<string, unknown>) {
  const count = Number(group.callCount ?? 0)
  return percent(count > 0 ? (Number(group.reportedCount ?? 0) / count) * 100 : 0)
}
function userInitials(user: MonitoringUser) {
  return [user.firstName, user.lastName]
    .filter(Boolean)
    .map((part) => String(part)[0].toUpperCase())
    .join('')
    .slice(0, 2)
}
function presenceLabel(user: MonitoringUser | Record<string, unknown>) {
  return user.online
    ? t('system.monitoringOnline')
    : Number(user.sessionCount ?? 0) > 0
      ? t('system.monitoringSession')
      : t('system.monitoringOffline')
}
function alertRuleTitle(rule?: MonitoringAlertRule) {
  if (!rule) return t('system.monitoringAlerts')
  return `${monitoringMetricLabel(t, locale.value, rule.metricKey)} · ${t(`system.monitoringHealth_${rule.severity}`)}`
}
function localizedMonitoringText(property: string, de: string, en: string) {
  const key = `system.${property}`
  const translated = t(key)
  if (translated.trim() && translated !== key) return translated
  return locale.value.toLowerCase().startsWith('de') ? de : en
}
function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}
</script>

<style scoped>
.sapling-monitoring {
  display: grid;
  gap: 18px;
  margin-bottom: 28px;
}
.sapling-monitoring__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 22px;
  overflow: hidden;
}
.sapling-monitoring__heading {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.sapling-monitoring__heading-icon {
  display: grid;
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.sapling-monitoring__toolbar h2,
.sapling-monitoring__heading p {
  margin: 0;
}
.sapling-monitoring__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.sapling-monitoring__actions > :not(.v-btn) {
  min-width: 180px;
}
.sapling-monitoring__navigation {
  position: sticky;
  top: 66px;
  z-index: 5;
  overflow: hidden;
  padding: 0 8px;
}
.sapling-monitoring__window {
  min-height: 360px;
}
.sapling-monitoring__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}
.sapling-monitoring__chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.sapling-monitoring__chart-grid--spaced {
  margin-top: 18px;
}
.sapling-monitoring__section-stack {
  display: grid;
  gap: 18px;
}
:deep(.sapling-monitoring__table-panel),
.sapling-monitoring__panel {
  padding: 20px;
}
:deep(.sapling-monitoring__table-panel.sapling-table-root) {
  min-height: auto;
}
:deep(.sapling-monitoring__table-scroll) {
  flex: 0 1 auto;
  overflow-x: auto;
  margin: 0 -8px -8px;
  border-radius: var(--sapling-radius-md);
}
:deep(.sapling-monitoring__table) {
  min-width: 720px;
  background: transparent !important;
}
:deep(.sapling-monitoring__table-scroll th) {
  white-space: nowrap;
}
:deep(.sapling-monitoring__table-scroll td) {
  white-space: nowrap;
}
:deep(.sapling-monitoring__count) {
  display: inline-grid;
  min-width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 99px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.sapling-monitoring__alerts-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, 0.92fr);
  gap: 16px;
  align-items: start;
}
.sapling-monitoring__alerts-grid > .sapling-monitoring__panel {
  min-width: 0;
  align-self: start;
}
.sapling-monitoring__incident-header {
  align-items: center;
}
.sapling-monitoring__alert-guidance {
  display: grid;
  gap: 6px;
  margin: 14px 0 12px;
  padding: 12px 14px;
  border: 1px solid var(--sapling-surface-border-muted);
  border-radius: var(--sapling-radius-md);
  background: var(--sapling-surface-fill-soft);
  color: color-mix(in srgb, var(--sapling-tilt-text-color) 76%, transparent);
  font-size: 0.82rem;
}
.sapling-monitoring__alert-guidance p {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}
.sapling-monitoring__incident-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  background: transparent;
}
.sapling-monitoring__incident-item {
  min-height: 84px;
  border: 1px solid var(--sapling-surface-border-muted);
  background: var(--sapling-surface-fill-soft);
}
:deep(.sapling-monitoring__incident-item .v-list-item__prepend),
:deep(.sapling-monitoring__incident-item .v-list-item__content),
:deep(.sapling-monitoring__incident-item .v-list-item__append) {
  align-self: center;
}
:deep(.sapling-monitoring__incident-item .v-list-item__content) {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.sapling-monitoring__incident-title {
  font-weight: 700;
  line-height: 1.25;
}
.sapling-monitoring__incident-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 14px;
  align-items: center;
  line-height: 1.35;
  opacity: 1;
}
.sapling-monitoring__incident-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sapling-monitoring__incident-icon {
  display: grid;
  width: 38px;
  height: 38px;
  margin-right: 12px;
  place-items: center;
  border-radius: 12px;
}
.sapling-monitoring__incident-state {
  display: grid;
  gap: 5px;
  justify-items: end;
  min-width: 72px;
}
.sapling-monitoring__incident-state small {
  color: color-mix(in srgb, var(--sapling-tilt-text-color) 72%, transparent);
  font-size: 0.7rem;
  white-space: nowrap;
}
.sapling-monitoring__incident-icon--warning {
  color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.14);
}
.sapling-monitoring__incident-icon--critical {
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-error), 0.14);
}
.sapling-monitoring__rule-groups {
  margin-top: 10px;
  max-height: min(640px, 68vh);
  padding-right: 3px;
  overflow-y: auto;
}
.sapling-monitoring__rule {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 110px;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
}
.sapling-monitoring__rule:last-child {
  border-bottom: 0;
}
.sapling-monitoring__rule-copy {
  display: grid;
}
.sapling-monitoring__rule-copy span {
  color: color-mix(in srgb, var(--sapling-tilt-text-color) 72%, transparent);
  font-size: 0.8rem;
}
.sapling-monitoring__clickable {
  cursor: pointer;
}
.sapling-monitoring__clickable:hover {
  background: rgba(var(--v-theme-primary), 0.045);
}
.sapling-monitoring__user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sapling-monitoring__dialog-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 12px;
}
.sapling-monitoring__user-dialog {
  max-height: min(86vh, 860px);
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface)) !important;
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42) !important;
}
.sapling-monitoring__dialog-title p {
  margin: 0;
}
.sapling-monitoring__detail-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}
.sapling-monitoring__detail-metrics article {
  display: grid;
  gap: 5px;
  padding: 14px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.035);
}
.sapling-monitoring__detail-metrics span {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
}
.sapling-monitoring__detail-sections {
  display: grid;
  gap: 24px;
}
@media (max-width: 1200px) {
  .sapling-monitoring__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sapling-monitoring__alerts-grid {
    grid-template-columns: 1fr;
  }
  .sapling-monitoring__rule-groups {
    max-height: none;
  }
}
@media (max-width: 900px) {
  .sapling-monitoring__toolbar,
  .sapling-monitoring__chart-grid {
    display: grid;
    grid-template-columns: 1fr;
  }
  .sapling-monitoring__actions {
    justify-content: flex-start;
  }
  .sapling-monitoring__metrics,
  .sapling-monitoring__detail-metrics {
    grid-template-columns: 1fr;
  }
  .sapling-monitoring__navigation {
    top: 58px;
  }
}
</style>
