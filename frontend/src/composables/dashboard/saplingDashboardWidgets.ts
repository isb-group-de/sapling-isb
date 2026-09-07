import type { DashboardItem, DashboardTemplateItem } from '@/entity/entity'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import { getKpiTileRows } from './saplingKpiTileSize'

/** Null is the legacy representation; an explicit empty array is an empty workspace. */
export function getDashboardWidgets(
  source: Pick<DashboardItem | DashboardTemplateItem, 'widgets' | 'kpis'> & {
    kpiOrder?: number[] | null
  },
): DashboardWidget[] {
  if (Array.isArray(source.widgets)) return JSON.parse(JSON.stringify(source.widgets))
  const order = new Map((source.kpiOrder ?? []).map((id, index) => [id, index]))
  return [...(source.kpis ?? [])]
    .sort(
      (a, b) =>
        (order.get(a.handle) ?? Infinity) - (order.get(b.handle) ?? Infinity) ||
        a.handle - b.handle,
    )
    .map((kpi) => {
      const type = typeof kpi.type === 'string' ? kpi.type : kpi.type?.handle
      const base = {
        id: `kpi-${kpi.handle}`,
        title: kpi.name,
        columns: 1,
        rows: getKpiTileRows(kpi),
      }
      return type === 'CALENDAR'
        ? {
            ...base,
            kind: 'AGENDA' as const,
            config: { filter: (kpi.filter ?? {}) as Record<string, unknown>, days: 90, limit: 5 },
          }
        : { ...base, kind: 'KPI' as const, config: { kpiHandle: kpi.handle } }
    })
}

export function cloneDashboardWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return JSON.parse(JSON.stringify(widgets))
}

export function isDashboardWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
