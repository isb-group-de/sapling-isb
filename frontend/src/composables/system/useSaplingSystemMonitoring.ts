import { computed, nextTick, onMounted, ref, watch, type Ref } from 'vue'
import ApiSystemService from '@/services/api.system.service'
import type {
  MonitoringAlertRule,
  MonitoringCheckRun,
  MonitoringChartPoint,
  MonitoringEnvironment,
  MonitoringErrorGroup,
  MonitoringIncident,
  MonitoringRemediationExecution,
  MonitoringServiceHealth,
  MonitoringSeriesPoint,
  MonitoringSummary,
  MonitoringUser,
} from '@/entity/system'
import { useVisibilityAwarePolling } from './useVisibilityAwarePolling'
import { useSaplingMessageCenter } from './useSaplingMessageCenter'

type RangePreset = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | 'custom'
type MonitoringDetail =
  | 'series'
  | 'requests'
  | 'users'
  | 'ai'
  | 'incidents'
  | 'rules'
  | 'status'
  | 'environments'
  | 'services'
  | 'errors'
  | 'checks'
  | 'remediations'
export const DEFAULT_MONITORING_RANGE_PRESET = '1h' satisfies RangePreset
export const MONITORING_USERS_PAGE_SIZE = 50
const MONITORING_METRICS = [
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

export function useSaplingSystemMonitoring(activeTab?: Readonly<Ref<string>>) {
  const { pushMessage } = useSaplingMessageCenter()
  let errorReported = false
  const rangePreset = ref<RangePreset>(DEFAULT_MONITORING_RANGE_PRESET)
  const rangeAnchor = ref(Date.now())
  const customFrom = ref(toLocalDateTime(new Date(Date.now() - 24 * 60 * 60_000)))
  const customTo = ref(toLocalDateTime(new Date()))
  const usersPage = ref(1)
  const selectedEnvironment = ref('')
  const environments = ref<MonitoringEnvironment[]>([])
  const summary = ref<MonitoringSummary | null>(null)
  const series = ref<MonitoringSeriesPoint[]>([])
  const requestSeries = ref<MonitoringChartPoint[]>([])
  const requestGroups = ref<Record<string, unknown>[]>([])
  const users = ref<MonitoringUser[]>([])
  const usersTotal = ref(0)
  const aiGroups = ref<Record<string, unknown>[]>([])
  const incidents = ref<MonitoringIncident[]>([])
  const rules = ref<MonitoringAlertRule[]>([])
  const collectorStatus = ref<Record<string, unknown> | null>(null)
  const services = ref<MonitoringServiceHealth[]>([])
  const errorGroups = ref<MonitoringErrorGroup[]>([])
  const checks = ref<MonitoringCheckRun[]>([])
  const remediations = ref<MonitoringRemediationExecution[]>([])
  const selectedUser = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const detailsLoading = ref(0)
  const error = ref<string | null>(null)
  const detailLoadedFor = new Map<MonitoringDetail, string>()
  const detailInFlight = new Map<string, Promise<void>>()
  let loadGeneration = 0
  let usersRequest = 0

  const range = computed(() => {
    if (rangePreset.value === 'custom') {
      return {
        from: new Date(customFrom.value).toISOString(),
        to: new Date(customTo.value).toISOString(),
      }
    }
    const to = new Date(rangeAnchor.value)
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

  const query = computed(() => {
    const params = new URLSearchParams(range.value)
    if (selectedEnvironment.value) params.set('environment', selectedEnvironment.value)
    return params.toString()
  })

  async function loadSummary() {
    if (rangePreset.value !== 'custom') rangeAnchor.value = Date.now()
    const querySnapshot = query.value
    try {
      const nextSummary = await ApiSystemService.get<MonitoringSummary>(
        `monitoring/summary?${querySnapshot}`,
      )
      if (querySnapshot !== query.value) return
      summary.value = nextSummary
      error.value = null
      errorReported = false
    } catch {
      if (querySnapshot === query.value) reportLoadError()
    }
  }

  async function loadAll() {
    if (rangePreset.value !== 'custom') rangeAnchor.value = Date.now()
    const generation = ++loadGeneration
    const querySnapshot = query.value
    const forceDetails = summary.value !== null
    loading.value = true
    error.value = null
    try {
      const nextSummary = await ApiSystemService.get<MonitoringSummary>(
        `monitoring/summary?${querySnapshot}`,
      )
      if (generation !== loadGeneration) return
      summary.value = nextSummary
      error.value = null
      errorReported = false
    } catch {
      if (generation === loadGeneration) reportLoadError()
    } finally {
      if (generation === loadGeneration) loading.value = false
    }

    if (generation !== loadGeneration) return
    await nextTick()
    await runWithConcurrency(
      [
        () => loadDetail('status', querySnapshot, generation, forceDetails),
        () => loadDetail('incidents', querySnapshot, generation, forceDetails),
        () => loadDetail('environments', querySnapshot, generation, forceDetails),
        () => loadDetail('services', querySnapshot, generation, forceDetails),
        ...visibleDetailTasks(
          activeTab?.value ?? 'overview',
          querySnapshot,
          generation,
          forceDetails,
        ),
      ],
      2,
    )
  }

  function visibleDetailTasks(
    tab: string,
    querySnapshot: string,
    generation: number,
    force = false,
  ): Array<() => Promise<void>> {
    return monitoringDetailsForArea(tab).map(
      (detail) => () => loadDetail(detail, querySnapshot, generation, force),
    )
  }

  async function loadVisibleDetails(tab: string) {
    await runWithConcurrency(visibleDetailTasks(tab, query.value, loadGeneration), 2)
  }

  function loadDetail(
    detail: MonitoringDetail,
    querySnapshot: string,
    generation: number,
    force = false,
  ): Promise<void> {
    if (!force && detailLoadedFor.get(detail) === querySnapshot) return Promise.resolve()
    const requestKey = `${generation}:${detail}:${querySnapshot}`
    const existing = detailInFlight.get(requestKey)
    if (existing) return existing

    detailsLoading.value += 1
    const request = fetchDetail(detail, querySnapshot, generation)
      .catch((loadError) => {
        if (generation === loadGeneration) reportLoadError(loadError)
      })
      .finally(() => {
        detailInFlight.delete(requestKey)
        detailsLoading.value = Math.max(0, detailsLoading.value - 1)
      })
    detailInFlight.set(requestKey, request)
    return request
  }

  async function fetchDetail(detail: MonitoringDetail, querySnapshot: string, generation: number) {
    const rangeIsCurrent = () => generation === loadGeneration && querySnapshot === query.value
    if (detail === 'series') {
      const response = await ApiSystemService.get<{ series: MonitoringSeriesPoint[] }>(
        `monitoring/series?${querySnapshot}&metrics=${encodeURIComponent(MONITORING_METRICS)}&resolution=auto`,
      )
      if (rangeIsCurrent()) series.value = response.series
    } else if (detail === 'requests') {
      const response = await ApiSystemService.get<{
        series: MonitoringChartPoint[]
        groups: Record<string, unknown>[]
      }>(`monitoring/requests?${querySnapshot}&groupBy=route`)
      if (rangeIsCurrent()) {
        requestSeries.value = response.series
        requestGroups.value = response.groups
      }
    } else if (detail === 'users') {
      await loadUsersPage(querySnapshot, generation)
    } else if (detail === 'ai') {
      const response = await ApiSystemService.get<{ groups: Record<string, unknown>[] }>(
        `monitoring/ai-usage?${querySnapshot}&groupBy=provider`,
      )
      if (rangeIsCurrent()) aiGroups.value = response.groups
    } else if (detail === 'incidents') {
      const response = await ApiSystemService.get<MonitoringIncident[]>(
        `monitoring/incidents?${querySnapshot}`,
      )
      if (rangeIsCurrent()) incidents.value = response
    } else if (detail === 'rules') {
      const response = await ApiSystemService.get<MonitoringAlertRule[]>('monitoring/alert-rules')
      if (generation === loadGeneration) rules.value = response
    } else if (detail === 'environments') {
      const response = await ApiSystemService.get<{
        current: string
        environments: MonitoringEnvironment[]
      }>('monitoring/environments')
      if (generation === loadGeneration) {
        environments.value = response.environments
        if (!selectedEnvironment.value) selectedEnvironment.value = response.current
      }
    } else if (detail === 'services') {
      const response = await ApiSystemService.get<{ services: MonitoringServiceHealth[] }>(
        `monitoring/services?${querySnapshot}`,
      )
      if (rangeIsCurrent()) services.value = response.services
    } else if (detail === 'errors') {
      const response = await ApiSystemService.get<{ groups: MonitoringErrorGroup[] }>(
        `monitoring/errors?${querySnapshot}`,
      )
      if (rangeIsCurrent()) errorGroups.value = response.groups
    } else if (detail === 'checks') {
      const response = await ApiSystemService.get<{ checks: MonitoringCheckRun[] }>(
        `monitoring/checks?${querySnapshot}`,
      )
      if (rangeIsCurrent()) checks.value = response.checks
    } else if (detail === 'remediations') {
      const response = await ApiSystemService.get<{ executions: MonitoringRemediationExecution[] }>(
        `monitoring/remediations?${querySnapshot}`,
      )
      if (rangeIsCurrent()) remediations.value = response.executions
    } else {
      const response = await ApiSystemService.get<Record<string, unknown>>(
        `monitoring/collector-status?${querySnapshot}`,
      )
      if (rangeIsCurrent()) collectorStatus.value = response
    }
    const isRangeDependent = [
      'series',
      'requests',
      'users',
      'ai',
      'services',
      'errors',
      'checks',
      'remediations',
    ].includes(detail)
    if (generation === loadGeneration && (!isRangeDependent || rangeIsCurrent())) {
      detailLoadedFor.set(detail, querySnapshot)
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

  async function loadUsersPage(querySnapshot = query.value, generation = loadGeneration) {
    const request = ++usersRequest
    const page = usersPage.value
    const nextUsers = await ApiSystemService.get<{
      data: MonitoringUser[]
      meta: { total: number }
    }>(
      `monitoring/users?${querySnapshot}&page=${page}&limit=${MONITORING_USERS_PAGE_SIZE}&sort=lastActivityAt`,
    )
    if (
      generation !== loadGeneration ||
      querySnapshot !== query.value ||
      request !== usersRequest ||
      page !== usersPage.value
    )
      return
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

  async function executeRemediation(actionKey: string, incidentHandle: number) {
    try {
      await ApiSystemService.post(`monitoring/remediations/${encodeURIComponent(actionKey)}`, {
        incidentHandle,
      })
      detailLoadedFor.delete('remediations')
      await loadAll()
    } catch (remediationError) {
      reportLoadError(remediationError)
      throw remediationError
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
  watch(usersPage, () => {
    if (['usage', 'users'].includes(activeTab?.value ?? 'users')) void loadUsersPage()
  })
  watch(selectedEnvironment, (next, previous) => {
    if (previous && next !== previous) void loadAll()
  })
  if (activeTab) watch(activeTab, (tab) => void loadVisibleDetails(tab))
  useVisibilityAwarePolling(loadSummary, 30_000)
  onMounted(() => void loadAll())

  return {
    rangePreset,
    selectedEnvironment,
    environments,
    customFrom,
    customTo,
    usersPage,
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
    selectedUser,
    loading,
    detailsLoading,
    error,
    loadAll,
    loadUser,
    updateRule,
    executeRemediation,
  }
}

export function monitoringDetailsForArea(tab: string): MonitoringDetail[] {
  if (tab === 'performance' || tab === 'requests') return ['series', 'requests']
  if (tab === 'overview' || tab === 'services') return ['series']
  if (tab === 'usage' || tab === 'users' || tab === 'ai') return ['users', 'ai']
  if (tab === 'incidents' || tab === 'alerts') {
    return ['incidents', 'rules', 'errors', 'checks', 'remediations']
  }
  return []
}

export async function runWithConcurrency(tasks: Array<() => Promise<void>>, concurrency: number) {
  const queue = [...tasks]
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), queue.length) },
    async () => {
      while (queue.length > 0) await queue.shift()?.()
    },
  )
  await Promise.all(workers)
}

function toLocalDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
