<template>
  <v-window-item class="monitoring-window-item" value="incidents">
    <div class="monitoring-incident-grid">
      <article class="monitoring-panel">
        <div class="monitoring-panel__header">
          <h3>{{ $t('system.monitoringIncidents') }}</h3>
          <v-btn
            prepend-icon="mdi-tune-variant"
            size="small"
            variant="tonal"
            @click="$emit('openRules')"
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
            @click="$emit('openIncident', incident.handle)"
          >
            <v-icon
              :color="incident.state === 'resolved' ? 'success' : incident.severity"
              icon="mdi-alert-circle-outline"
            />
            <span>
              <strong>{{ metricLabel(incident.rule.metricKey) }}</strong>
              <small
                >{{ stateLabel(incident.state) }} ·
                {{ incidentTypeLabel(incident.incidentType || 'threshold') }}</small
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
</template>

<script setup lang="ts">
import type {
  MonitoringCheckRun,
  MonitoringErrorGroup,
  MonitoringIncident,
  MonitoringRemediationExecution,
} from '@/entity/system'

defineProps<{
  incidents: MonitoringIncident[]
  errorGroups: MonitoringErrorGroup[]
  checks: MonitoringCheckRun[]
  remediations: MonitoringRemediationExecution[]
  number: (value: unknown) => string
  dateTime: (value: string | null | undefined) => string
  metricLabel: (value: string) => string
  checkLabel: (value: string) => string
  stateLabel: (value: string) => string
  incidentTypeLabel: (value: string) => string
  remediationLabel: (value: string) => string
  statusColor: (value: string) => string
}>()

defineEmits<{
  openRules: []
  openIncident: [handle: number]
}>()
</script>
