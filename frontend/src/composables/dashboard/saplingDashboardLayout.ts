import type { DashboardItem } from '@/entity/entity'

/**
 * Restores the pre-edit ordering while keeping removals that were already persisted.
 */
export function restoreDashboardLayoutSnapshot(
  snapshot: DashboardItem[],
  currentDashboards: DashboardItem[],
): DashboardItem[] {
  const currentByHandle = new Map(
    currentDashboards.flatMap((dashboard) =>
      dashboard.handle == null ? [] : [[dashboard.handle, dashboard] as const],
    ),
  )

  return snapshot.flatMap((snapshotDashboard) => {
    if (snapshotDashboard.handle == null) {
      return []
    }

    const currentDashboard = currentByHandle.get(snapshotDashboard.handle)
    if (!currentDashboard) {
      return []
    }

    const currentKpiHandles = new Set((currentDashboard.kpis ?? []).map((kpi) => kpi.handle))
    const restoredKpis = (snapshotDashboard.kpis ?? []).filter((kpi) =>
      currentKpiHandles.has(kpi.handle),
    )

    return [
      {
        ...snapshotDashboard,
        kpis: restoredKpis,
        kpiOrder: restoredKpis.map((kpi) => kpi.handle),
      },
    ]
  })
}
