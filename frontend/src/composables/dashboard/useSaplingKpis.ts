import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import ApiGenericService from '@/services/api.generic.service'
import type { KPIItem, DashboardItem } from '../../entity/entity'

/**
 * Encapsulates KPI assignment state and actions for a single dashboard instance.
 */
export function useSaplingKpis(
  dashboard: MaybeRefOrGetter<DashboardItem>,
  onKpisChange?: (kpis: KPIItem[]) => void,
) {
  // #region State
  const kpis = ref<KPIItem[]>([])
  const kpiDeleteDialog = ref(false)
  const kpiToDelete = ref<KPIItem | null>(null)
  const addKpiDialog = ref(false)
  const selectedKpi = ref<KPIItem | null>(null)
  // #endregion

  // #region Sync
  watch(
    () => toValue(dashboard)?.kpis,
    (nextKpis) => {
      kpis.value = Array.isArray(nextKpis) ? [...nextKpis] : []
    },
    { immediate: true, deep: true },
  )
  // #endregion

  // #region Methods
  function updateKpis(nextKpis: KPIItem[]) {
    kpis.value = [...nextKpis]
    onKpisChange?.([...nextKpis])
  }

  async function persistKpiOrder(nextKpis: KPIItem[]) {
    const currentDashboard = toValue(dashboard)
    if (currentDashboard.handle == null) {
      return
    }

    await ApiGenericService.update('dashboard', currentDashboard.handle, {
      kpiOrder: nextKpis.map((kpi) => kpi.handle),
    })
  }

  function reorderKpis(draggedHandle: number, targetHandle: number) {
    const fromIndex = kpis.value.findIndex((kpi) => kpi.handle === draggedHandle)
    const targetIndex = kpis.value.findIndex((kpi) => kpi.handle === targetHandle)
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) {
      return
    }

    const nextKpis = [...kpis.value]
    const [movedKpi] = nextKpis.splice(fromIndex, 1)
    nextKpis.splice(targetIndex, 0, movedKpi)
    updateKpis(nextKpis)
  }

  /**
   * Closes the add-KPI dialog and clears the current selection.
   */
  function closeAddKpiDialog() {
    addKpiDialog.value = false
    selectedKpi.value = null
  }

  /**
   * Persists the selected KPI after the dialog has already validated the form.
   */
  async function validateAndAddKpi() {
    await addKpiToDashboard()
  }

  /**
   * Opens the KPI delete dialog for the KPI belonging to the current dashboard.
   */
  function openKpiDeleteDialog(kpiHandle: number) {
    kpiToDelete.value = kpis.value.find((kpi) => kpi.handle === kpiHandle) || null
    kpiDeleteDialog.value = kpiToDelete.value !== null
  }

  /**
   * Deletes the currently selected KPI reference from the dashboard.
   */
  async function confirmKpiDelete() {
    const currentDashboard = toValue(dashboard)

    if (currentDashboard.handle != null && kpiToDelete.value && kpiToDelete.value.handle != null) {
      await ApiGenericService.deleteReference<DashboardItem>(
        'dashboard',
        'kpis',
        currentDashboard.handle,
        kpiToDelete.value.handle,
      )

      const nextKpis = kpis.value.filter((kpi) => kpi.handle !== kpiToDelete.value?.handle)
      updateKpis(nextKpis)
      await persistKpiOrder(nextKpis)
    }

    cancelKpiDelete()
  }

  /**
   * Closes the KPI delete dialog and clears the current selection.
   */
  function cancelKpiDelete() {
    kpiDeleteDialog.value = false
    kpiToDelete.value = null
  }

  /** Opens the standard KPI reference selector for the current dashboard. */
  function openAddKpiDialog() {
    const currentDashboard = toValue(dashboard)

    if (currentDashboard.handle == null) {
      return
    }

    selectedKpi.value = null
    addKpiDialog.value = true
  }

  /**
   * Persists a KPI reference on the current dashboard and updates the local dashboard list in place.
   */
  async function addKpiToDashboard() {
    const currentDashboard = toValue(dashboard)

    if (currentDashboard.handle != null && selectedKpi.value && selectedKpi.value.handle != null) {
      const createdKpi = await ApiGenericService.createReference<KPIItem>(
        'kpi',
        'dashboards',
        selectedKpi.value.handle,
        currentDashboard.handle,
      )

      if (!kpis.value.some((kpi) => kpi.handle === createdKpi.handle)) {
        const nextKpis = [...kpis.value, createdKpi]
        updateKpis(nextKpis)
        await persistKpiOrder(nextKpis)
      }

      closeAddKpiDialog()
    }
  }
  // #endregion

  // #region Return
  return {
    kpis,
    kpiDeleteDialog,
    kpiToDelete,
    addKpiDialog,
    selectedKpi,
    validateAndAddKpi,
    closeAddKpiDialog,
    openKpiDeleteDialog,
    confirmKpiDelete,
    cancelKpiDelete,
    openAddKpiDialog,
    reorderKpis,
  }
  // #endregion
}
