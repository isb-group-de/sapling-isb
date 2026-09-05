<template>
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
        <SaplingDataTable
          class="sapling-table monitoring-table"
          :items="users"
          :columns="[
            {
              key: 'c0',
              title: $t('system.monitoringUser'),
              value: (user) => [user.firstName, user.lastName].filter(Boolean).join(' '),
            },
            {
              key: 'c1',
              title: $t('system.monitoringPresence'),
              value: (user) => userPresenceLabel(user),
            },
            {
              key: 'c2',
              title: $t('system.monitoringValidSessions'),
              value: (user) => user.sessionCount,
            },
            {
              key: 'c3',
              title: $t('system.monitoringLastSeen'),
              value: (user) => user.lastActivityAt,
            },
            {
              key: 'c4',
              title: $t('system.monitoringLastLogin'),
              value: (user) => user.lastLoginAt,
            },
            {
              key: 'c5',
              title: $t('system.monitoringRequests'),
              value: (user) => user.requests,
            },
            { key: 'c6', title: $t('system.monitoringErrors'), value: (user) => user.errors },
            {
              key: 'c7',
              title: $t('system.monitoringTraffic'),
              value: (user) => user.traffic,
            },
            { key: 'c8', title: $t('system.monitoringTokens'), value: (user) => user.tokens },
          ]"
        >
          <template #row="{ item: user }">
            <tr>
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
              <td>{{ bytes(user.traffic) }}</td>
              <td>{{ compactNumber(user.tokens) }}</td>
            </tr>
          </template>
        </SaplingDataTable>
      </article>
      <article class="monitoring-panel monitoring-panel--ai">
        <div class="monitoring-panel__header">
          <h3>{{ $t('system.monitoringAiTokens') }}</h3>
          <span>{{ aiGroups.length }}</span>
        </div>
        <SaplingDataTable
          class="sapling-table monitoring-table"
          :items="aiGroups"
          :columns="[
            { key: 'c0', title: $t('system.monitoringProvider'), value: (row) => row.group },
            { key: 'c1', title: $t('system.monitoringCalls'), value: (row) => row.callCount },
            {
              key: 'c2',
              title: $t('system.monitoringErrors'),
              value: (row) => row.errorCount,
            },
            {
              key: 'c3',
              title: $t('system.monitoringTokens'),
              value: (row) => row.totalTokens,
            },
          ]"
        >
          <template #row="{ item: row }">
            <tr>
              <td>{{ row.group }}</td>
              <td>{{ number(row.callCount) }}</td>
              <td>{{ number(row.errorCount) }}</td>
              <td>{{ compactNumber(row.totalTokens) }}</td>
            </tr>
          </template>
        </SaplingDataTable>
      </article>
    </div>
  </v-window-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingDataTable from '@/components/table/SaplingDataTable.vue'
import type { MonitoringSummary, MonitoringUser } from '@/entity/system'
const props = defineProps<{
  users: MonitoringUser[]
  usersTotal: number
  aiGroups: Record<string, unknown>[]
  summary: MonitoringSummary | null
  number: (value: unknown) => string
  bytes: (value: unknown) => string
  compactNumber: (value: unknown) => string
  dateTime: (value: string | null | undefined) => string
}>()
const { t } = useI18n()
const presenceSummary = computed(() => {
  const online = props.summary?.users.onlineUsers ?? 0
  const signedIn = props.summary?.users.usersWithSessions ?? 0
  return [
    {
      key: 'online',
      icon: 'mdi-circle-medium',
      label: t('system.monitoringOnline'),
      value: props.number(online),
    },
    {
      key: 'session',
      icon: 'mdi-account-clock-outline',
      label: t('system.monitoringSession'),
      value: props.number(Math.max(signedIn - online, 0)),
    },
    {
      key: 'offline',
      icon: 'mdi-account-off-outline',
      label: t('system.monitoringOffline'),
      value: props.number(Math.max(props.usersTotal - signedIn, 0)),
    },
  ]
})
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
</script>
