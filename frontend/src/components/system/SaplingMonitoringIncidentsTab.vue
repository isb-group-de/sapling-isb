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
          <p v-if="!incidents.length" class="sapling-muted-text">{{ $t('global.noData') }}</p>
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
        <SaplingDataTable
          class="sapling-table monitoring-table"
          :items="errorGroups"
          :columns="[
            { key: 'c0', title: $t('system.monitoringSource'), value: (group) => group.source },
            {
              key: 'c1',
              title: $t('system.monitoringOperation'),
              value: (group) => group.operation,
            },
            {
              key: 'c2',
              title: $t('system.monitoringCount'),
              value: (group) => group.occurrenceCount,
            },
            {
              key: 'c3',
              title: $t('system.monitoringLastSeen'),
              value: (group) => group.lastSeenAt,
            },
          ]"
        >
          <template #row="{ item: group }">
            <tr>
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
          </template>
        </SaplingDataTable>
      </article>
    </div>

    <div class="monitoring-incident-grid">
      <article class="monitoring-panel">
        <div class="monitoring-panel__header">
          <h3>{{ $t('system.monitoringChecks') }}</h3>
          <span>{{ checks.length }}</span>
        </div>
        <SaplingDataTable
          class="sapling-table monitoring-table"
          :items="checks"
          :columns="[
            {
              key: 'c0',
              title: $t('system.monitoringCheck'),
              value: (check) => checkLabel(check.checkKey),
            },
            {
              key: 'c1',
              title: $t('system.monitoringStatus'),
              value: (check) => stateLabel(check.status),
            },
            {
              key: 'c2',
              title: $t('system.monitoringDuration'),
              value: (check) => check.durationMs,
            },
            { key: 'c3', title: $t('system.monitoringTime'), value: (check) => check.completedAt },
          ]"
        >
          <template #row="{ item: check }">
            <tr>
              <td>{{ checkLabel(check.checkKey) }}</td>
              <td>
                <v-chip :color="statusColor(check.status)" size="x-small">{{
                  stateLabel(check.status)
                }}</v-chip>
              </td>
              <td>{{ number(check.durationMs) }} ms</td>
              <td>{{ dateTime(check.completedAt) }}</td>
            </tr>
          </template>
        </SaplingDataTable>
      </article>
      <article class="monitoring-panel">
        <div class="monitoring-panel__header">
          <h3>{{ $t('system.monitoringRemediationHistory') }}</h3>
          <span>{{ remediations.length }}</span>
        </div>
        <SaplingDataTable
          class="sapling-table monitoring-table"
          :items="remediations"
          :columns="[
            {
              key: 'c0',
              title: $t('system.monitoringAction'),
              value: (execution) => remediationLabel(execution.actionKey),
            },
            {
              key: 'c1',
              title: $t('system.monitoringMode'),
              value: (execution) => stateLabel(execution.mode),
            },
            {
              key: 'c2',
              title: $t('system.monitoringResult'),
              value: (execution) => stateLabel(execution.state),
            },
            {
              key: 'c3',
              title: $t('system.monitoringTime'),
              value: (execution) => execution.startedAt,
            },
          ]"
        >
          <template #row="{ item: execution }">
            <tr>
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
          </template>
        </SaplingDataTable>
      </article>
    </div>
  </v-window-item>
</template>

<script setup lang="ts">
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
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
