import { computed, onMounted, ref, watch } from 'vue'
import ApiSystemService from '@/services/api.system.service'
import type {
  MonitoringAlertRule,
  MonitoringIncident,
  MonitoringSeriesPoint,
  MonitoringSummary,
  MonitoringUser,
} from '@/entity/system'
import { useVisibilityAwarePolling } from './useVisibilityAwarePolling'
import { useSaplingMessageCenter } from './useSaplingMessageCenter'

type RangePreset = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | 'custom'
export const MONITORING_USERS_PAGE_SIZE = 50

export function useSaplingSystemMonitoring() {
  const { pushMessage } = useSaplingMessageCenter()
  let errorReported = false
  const rangePreset = ref<RangePreset>('24h')
  const customFrom = ref(toLocalDateTime(new Date(Date.now() - 24 * 60 * 60_000)))
  const customTo = ref(toLocalDateTime(new Date()))
  const usersPage = ref(1)
  const summary = ref<MonitoringSummary | null>(null)
  const series = ref<MonitoringSeriesPoint[]>([])
  const requestGroups = ref<Record<string, unknown>[]>([])
  const users = ref<MonitoringUser[]>([])
  const usersTotal = ref(0)
  const aiGroups = ref<Record<string, unknown>[]>([])
  const incidents = ref<MonitoringIncident[]>([])
  const rules = ref<MonitoringAlertRule[]>([])
  const collectorStatus = ref<Record<string, unknown> | null>(null)
  const selectedUser = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const range = computed(() => {
    if (rangePreset.value === 'custom') {
      return {
        from: new Date(customFrom.value).toISOString(),
        to: new Date(customTo.value).toISOString(),
      }
    }
    const to = new Date()
    const duration = {
      '1h': 60 * 60_000,
      '6h': 6 * 60 * 60_000,
      '24h': 24 * 60 * 60_000,
      '7d': 7 * 24 * 60 * 60_000,
      '30d': 30 * 24 * 60 * 60_000,
      '90d': 90 * 24 * 60 * 60_000,
      custom: 24 * 60 * 60_000,
    }[rangePreset.value]
    return { from: new Date(to.getTime() - duration).toISOString(), to: to.toISOString() }
  })

  const query = computed(() => new URLSearchParams(range.value).toString())

  async function loadSummary() {
    try {
      summary.value = await ApiSystemService.get<MonitoringSummary>(
        `monitoring/summary?${query.value}`,
      )
      error.value = null
      errorReported = false
    } catch {
      reportLoadError()
    }
  }

  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      const metrics = [
        'host.cpu.percent',
        'host.memory.usedPercent',
        'process.memory.rssBytes',
        'process.memory.heapUsedBytes',
        'process.eventLoop.p95Ms',
        'network.rxBytesPerSecond',
        'network.txBytesPerSecond',
        'database.connectionUsedPercent',
        'database.sizeBytes',
        'filesystem.usedPercent',
        'documentStorage.sizeBytes',
      ].join(',')
      const [nextSummary, nextSeries, requests, nextUsers, ai, nextIncidents, nextRules, status] =
        await Promise.all([
          ApiSystemService.get<MonitoringSummary>(`monitoring/summary?${query.value}`),
          ApiSystemService.get<{ series: MonitoringSeriesPoint[] }>(
            `monitoring/series?${query.value}&metrics=${encodeURIComponent(metrics)}&resolution=auto`,
          ),
          ApiSystemService.get<{ groups: Record<string, unknown>[] }>(
            `monitoring/requests?${query.value}&groupBy=route`,
          ),
          ApiSystemService.get<{ data: MonitoringUser[]; meta: { total: number } }>(
            `monitoring/users?${query.value}&page=${usersPage.value}&limit=${MONITORING_USERS_PAGE_SIZE}&sort=lastActivityAt`,
          ),
          ApiSystemService.get<{ groups: Record<string, unknown>[] }>(
            `monitoring/ai-usage?${query.value}&groupBy=provider`,
          ),
          ApiSystemService.get<MonitoringIncident[]>('monitoring/incidents'),
          ApiSystemService.get<MonitoringAlertRule[]>('monitoring/alert-rules'),
          ApiSystemService.get<Record<string, unknown>>('monitoring/collector-status'),
        ])
      summary.value = nextSummary
      series.value = nextSeries.series
      requestGroups.value = requests.groups
      users.value = nextUsers.data
      usersTotal.value = nextUsers.meta.total
      aiGroups.value = ai.groups
      incidents.value = nextIncidents
      rules.value = nextRules
      collectorStatus.value = status
    } catch {
      reportLoadError()
    } finally {
      loading.value = false
    }
  }

  async function loadUser(handle: number) {
    try {
      selectedUser.value = await ApiSystemService.get<Record<string, unknown>>(
        `monitoring/users/${handle}?${query.value}`,
      )
    } catch (loadError) {
      reportLoadError(loadError)
      throw loadError
    }
  }

  async function loadUsersPage() {
    const nextUsers = await ApiSystemService.get<{
      data: MonitoringUser[]
      meta: { total: number }
    }>(
      `monitoring/users?${query.value}&page=${usersPage.value}&limit=${MONITORING_USERS_PAGE_SIZE}&sort=lastActivityAt`,
    )
    users.value = nextUsers.data
    usersTotal.value = nextUsers.meta.total
  }

  async function updateRule(rule: MonitoringAlertRule) {
    try {
      const updated = await ApiSystemService.patch<MonitoringAlertRule>(
        `monitoring/alert-rules/${rule.handle}`,
        {
          isActive: rule.isActive,
          threshold: Number(rule.threshold),
          windowSeconds: Number(rule.windowSeconds),
          minimumCount: Number(rule.minimumCount),
        },
      )
      const index = rules.value.findIndex((entry) => entry.handle === updated.handle)
      if (index >= 0) rules.value[index] = updated
    } catch (updateError) {
      reportLoadError(updateError)
    }
  }

  function reportLoadError(technical?: unknown) {
    error.value = 'system.monitoringLoadFailed'
    if (errorReported) return
    errorReported = true
    pushMessage('error', 'system.monitoringLoadFailed', '', 'systemMonitoring', technical)
  }

  watch(rangePreset, () => {
    usersPage.value = 1
    void loadAll()
  })
  watch([customFrom, customTo], () => {
    if (rangePreset.value === 'custom') void loadAll()
  })
  watch(usersPage, () => void loadUsersPage())
  useVisibilityAwarePolling(loadSummary, 30_000)
  onMounted(() => void loadAll())

  return {
    rangePreset,
    customFrom,
    customTo,
    usersPage,
    summary,
    series,
    requestGroups,
    users,
    usersTotal,
    aiGroups,
    incidents,
    rules,
    collectorStatus,
    selectedUser,
    loading,
    error,
    loadAll,
    loadUser,
    updateRule,
  }
}

function toLocalDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
