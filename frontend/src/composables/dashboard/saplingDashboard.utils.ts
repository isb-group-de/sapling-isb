import type { DashboardItem, DashboardTemplateItem } from '@/entity/entity'

export interface DashboardForm {
  name: string
  kpis?: DashboardItem['kpis'] | number[]
  [key: string]: unknown
}

export interface KpiRelationSource {
  kpis?: DashboardItem['kpis'] | DashboardTemplateItem['kpis'] | number[]
}

export function cloneDashboardLayout(items: DashboardItem[]): DashboardItem[] {
  return items.map((dashboard) => ({
    ...dashboard,
    kpiOrder: [...(dashboard.kpiOrder ?? [])],
    kpis: Array.isArray(dashboard.kpis) ? [...dashboard.kpis] : [],
  }))
}

export function sortDashboards(items: DashboardItem[]): DashboardItem[] {
  return [...items].sort(
    (left, right) =>
      (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      (left.handle ?? Number.MAX_SAFE_INTEGER) - (right.handle ?? Number.MAX_SAFE_INTEGER),
  )
}

export function withSortedKpis(dashboard: DashboardItem): DashboardItem {
  const order = new Map((dashboard.kpiOrder ?? []).map((handle, index) => [handle, index]))
  const kpis = Array.isArray(dashboard.kpis) ? [...dashboard.kpis] : []
  kpis.sort(
    (left, right) =>
      (order.get(left.handle) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.handle) ?? Number.MAX_SAFE_INTEGER) || left.handle - right.handle,
  )
  return { ...dashboard, kpis, kpiOrder: kpis.map((kpi) => kpi.handle) }
}

export function getNextDashboardSortOrder(dashboards: DashboardItem[]): number {
  return (
    dashboards.reduce((highest, dashboard) => Math.max(highest, dashboard.sortOrder ?? 0), 0) + 100
  )
}

export function getKpiHandles(source: KpiRelationSource): number[] {
  if (!Array.isArray(source.kpis)) {
    return []
  }

  return [
    ...new Set(
      source.kpis
        .map((kpi) => {
          if (typeof kpi === 'number') {
            return kpi
          }

          if (kpi && typeof kpi === 'object' && typeof kpi.handle === 'number') {
            return kpi.handle
          }

          return null
        })
        .filter((handle): handle is number => handle !== null),
    ),
  ]
}

/**
 * Builds a dashboard payload without KPI relations, which are persisted separately.
 */
export function toDashboardPayload(form: DashboardForm): Omit<DashboardForm, 'kpis'> {
  const payload = { ...form }
  delete payload.kpis
  return payload
}
