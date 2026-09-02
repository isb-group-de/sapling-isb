import { ref, type ComputedRef, type Ref } from 'vue'
import ApiCurrentService from '@/services/api.current.service'
import { restoreDashboardLayoutSnapshot } from './saplingDashboardLayout'
import { cloneDashboardLayout } from './saplingDashboard.utils'
import type { DashboardItem } from '@/entity/entity'

type PushMessage = (
  type: 'success' | 'info' | 'warning' | 'error',
  title: string,
  description: string,
  entity: string,
  technical?: unknown,
  descriptionParams?: Record<string, unknown>,
) => void

export function useSaplingDashboardLayout(options: {
  dashboards: Ref<DashboardItem[]>
  activeTab: Ref<number>
  currentDashboard: ComputedRef<DashboardItem | null>
  pushMessage: PushMessage
}) {
  const { dashboards, activeTab, currentDashboard, pushMessage } = options
  const isLayoutEditing = ref(false)
  const isLayoutSaving = ref(false)
  const layoutSnapshot = ref<DashboardItem[] | null>(null)

  function updateDashboardKpis(
    dashboardHandle: DashboardItem['handle'],
    kpis: DashboardItem['kpis'],
  ) {
    const dashboardIndex = dashboards.value.findIndex(
      (dashboard) => dashboard.handle === dashboardHandle,
    )

    if (dashboardIndex === -1) {
      return
    }

    dashboards.value[dashboardIndex] = {
      ...dashboards.value[dashboardIndex],
      kpis: Array.isArray(kpis) ? [...kpis] : [],
      kpiOrder: Array.isArray(kpis)
        ? kpis.flatMap((kpi) => (kpi.handle == null ? [] : [kpi.handle]))
        : [],
    }
  }

  function beginLayoutEdit() {
    if (!dashboards.value.length || isLayoutEditing.value) {
      return
    }

    layoutSnapshot.value = cloneDashboardLayout(dashboards.value)
    isLayoutEditing.value = true
  }

  function cancelLayoutEdit() {
    if (layoutSnapshot.value) {
      const activeHandle = currentDashboard.value?.handle
      dashboards.value = restoreDashboardLayoutSnapshot(layoutSnapshot.value, dashboards.value)
      const nextIndex = dashboards.value.findIndex((dashboard) => dashboard.handle === activeHandle)
      activeTab.value = nextIndex >= 0 ? nextIndex : 0
    }

    layoutSnapshot.value = null
    isLayoutEditing.value = false
  }

  function reorderDashboards(draggedHandle: number, targetHandle: number) {
    const fromIndex = dashboards.value.findIndex((dashboard) => dashboard.handle === draggedHandle)
    const targetIndex = dashboards.value.findIndex((dashboard) => dashboard.handle === targetHandle)
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) {
      return
    }

    const activeHandle = currentDashboard.value?.handle
    const nextDashboards = [...dashboards.value]
    const [movedDashboard] = nextDashboards.splice(fromIndex, 1)
    nextDashboards.splice(targetIndex, 0, movedDashboard)
    dashboards.value = nextDashboards
    const nextActiveIndex = dashboards.value.findIndex(
      (dashboard) => dashboard.handle === activeHandle,
    )
    activeTab.value = nextActiveIndex >= 0 ? nextActiveIndex : 0
  }

  async function saveLayout() {
    if (!isLayoutEditing.value || isLayoutSaving.value) {
      return
    }

    const layout = dashboards.value.flatMap((dashboard) =>
      dashboard.handle == null
        ? []
        : [
            {
              handle: dashboard.handle,
              kpiOrder: (dashboard.kpis ?? []).flatMap((kpi) =>
                kpi.handle == null ? [] : [kpi.handle],
              ),
            },
          ],
    )
    if (layout.length !== dashboards.value.length) {
      return
    }

    isLayoutSaving.value = true
    try {
      await ApiCurrentService.updateDashboardLayout({ dashboards: layout })
      dashboards.value = dashboards.value.map((dashboard, index) => ({
        ...dashboard,
        sortOrder: (index + 1) * 100,
        kpiOrder: (dashboard.kpis ?? []).flatMap((kpi) => (kpi.handle == null ? [] : [kpi.handle])),
      }))
      layoutSnapshot.value = null
      isLayoutEditing.value = false
      pushMessage(
        'success',
        'dashboard.layoutSaved',
        'dashboard.layoutSavedDescription',
        'dashboard',
      )
    } finally {
      isLayoutSaving.value = false
    }
  }
  // #endregion

  return {
    isLayoutEditing,
    isLayoutSaving,
    updateDashboardKpis,
    beginLayoutEdit,
    cancelLayoutEdit,
    reorderDashboards,
    saveLayout,
  }
}
