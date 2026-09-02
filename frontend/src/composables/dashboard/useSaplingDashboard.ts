import { computed, onMounted, ref } from 'vue'
import ApiGenericService from '@/services/api.generic.service'
import ApiTemplateService from '@/services/api.template.service'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingDashboardLayout } from './useSaplingDashboardLayout'
import {
  getNextDashboardSortOrder,
  getKpiHandles,
  sortDashboards,
  toDashboardPayload,
  withSortedKpis,
  type DashboardForm,
} from './saplingDashboard.utils'
import type {
  DashboardItem,
  DashboardTemplateItem,
  EntityItem,
  SaplingGenericItem,
} from '../../entity/entity'
import type {
  DialogSaveAction,
  DialogSaveContext,
  EditDialogOptions,
  EntityTemplate,
} from '@/entity/structure'

type DashboardPayload = Omit<Partial<DashboardItem>, 'kpis' | 'person'> & {
  person: NonNullable<DashboardItem['person']>
}

type DashboardTemplatePayload = Omit<Partial<DashboardTemplateItem>, 'kpis' | 'person'> & {
  person: NonNullable<DashboardTemplateItem['person']>
}

/**
 * Encapsulates dashboard loading, CRUD state, and dashboard-template workflows.
 */
export function useSaplingDashboard() {
  // #region State
  const dashboardDeleteDialog = ref(false)
  const dashboardToDelete = ref<DashboardItem | null>(null)
  const dashboardDialog = ref<EditDialogOptions>({ visible: false, mode: 'create', item: null })
  const dashboardTemplateDialog = ref<EditDialogOptions>({
    visible: false,
    mode: 'create',
    item: null,
  })
  const dashboardTemplateLoadDialog = ref(false)
  const applyingDashboardTemplateHandle = ref<DashboardTemplateItem['handle'] | null>(null)
  const dashboardEntity = ref<EntityItem | null>(null)
  const dashboardEntityTemplates = ref<EntityTemplate[]>([])
  const dashboardTemplateEntity = ref<EntityItem | null>(null)
  const dashboardTemplateEntityTemplates = ref<EntityTemplate[]>([])
  const availableDashboardTemplates = ref<DashboardTemplateItem[]>([])
  const dashboards = ref<DashboardItem[]>([])
  const activeTab = ref(0)
  const currentPersonStore = useCurrentPersonStore()
  const { pushMessage } = useSaplingMessageCenter()
  const { isLoading, loadTranslations } = useTranslationLoader(
    'global',
    'dashboard',
    'dashboardTemplate',
    'kpi',
    'person',
    'navigation',
  )
  const currentDashboard = computed(() => dashboards.value[activeTab.value] ?? null)
  const {
    isLayoutEditing,
    isLayoutSaving,
    updateDashboardKpis,
    beginLayoutEdit,
    cancelLayoutEdit,
    reorderDashboards,
    saveLayout,
  } = useSaplingDashboardLayout({ dashboards, activeTab, currentDashboard, pushMessage })
  const hasDashboards = computed(() => dashboards.value.length > 0)
  const isDashboardRemovable = computed(() => dashboards.value.length > 1)
  // #endregion

  // #region Lifecycle
  onMounted(async () => {
    await Promise.all([
      loadTranslations(),
      loadDashboardEntity(true),
      loadDashboardEntityTemplates(true),
      loadDashboardTemplateEntity(true),
      loadDashboardTemplateEntityTemplates(true),
      currentPersonStore.fetchCurrentPerson(),
    ])

    await Promise.all([loadDashboards(true), loadAvailableDashboardTemplates(true)])
  })
  // #endregion

  // #region Loaders
  /**
   * Loads all dashboards for the current person including their KPI relations.
   */
  async function loadDashboards(suppressErrorMessage = false) {
    if (!currentPersonStore.person?.handle) {
      dashboards.value = []
      syncActiveTab()
      return
    }

    const dashboardRes = await ApiGenericService.findAll<DashboardItem>('dashboard', {
      filter: { person: { handle: currentPersonStore.person.handle } },
      relations: ['kpis'],
      suppressErrorMessage,
    })

    dashboards.value = sortDashboards(dashboardRes).map(withSortedKpis)
    syncActiveTab()
  }

  /**
   * Loads the dashboard form templates used by the shared edit dialog.
   */
  async function loadDashboardEntityTemplates(suppressErrorMessage = false) {
    dashboardEntityTemplates.value = await ApiTemplateService.getEntityTemplate(
      'dashboard',
      false,
      { suppressErrorMessage },
    )
  }

  /**
   * Loads the dashboard entity metadata required by the shared edit dialog.
   */
  async function loadDashboardEntity(suppressErrorMessage = false) {
    dashboardEntity.value =
      (
        await ApiGenericService.find<EntityItem>('entity', {
          filter: { handle: 'dashboard' },
          limit: 1,
          page: 1,
          suppressErrorMessage,
        })
      ).data[0] || null
  }

  /**
   * Loads the dashboard-template form templates used by the shared edit dialog.
   */
  async function loadDashboardTemplateEntityTemplates(suppressErrorMessage = false) {
    dashboardTemplateEntityTemplates.value = await ApiTemplateService.getEntityTemplate(
      'dashboardTemplate',
      false,
      {
        suppressErrorMessage,
      },
    )
  }

  /**
   * Loads the dashboard-template entity metadata required by the shared edit dialog.
   */
  async function loadDashboardTemplateEntity(suppressErrorMessage = false) {
    dashboardTemplateEntity.value =
      (
        await ApiGenericService.find<EntityItem>('entity', {
          filter: { handle: 'dashboardTemplate' },
          limit: 1,
          page: 1,
          suppressErrorMessage,
        })
      ).data[0] || null
  }

  /**
   * Loads all dashboard templates visible to the current user.
   */
  async function loadAvailableDashboardTemplates(suppressErrorMessage = false) {
    if (!currentPersonStore.person?.handle) {
      availableDashboardTemplates.value = []
      return
    }

    const response = await ApiGenericService.findAll<DashboardTemplateItem>('dashboardTemplate', {
      orderBy: { isShared: 'DESC', name: 'ASC' },
      relations: ['kpis', 'person'],
      suppressErrorMessage,
    })

    availableDashboardTemplates.value = response
  }
  // #endregion

  // #region Helpers
  /**
   * Keeps the active tab within the currently available dashboard range.
   */
  function syncActiveTab() {
    if (!dashboards.value.length) {
      activeTab.value = 0
      return
    }

    activeTab.value = Math.min(Math.max(activeTab.value, 0), dashboards.value.length - 1)
  }

  /**
   * Closes the delete dialog and clears the selected dashboard reference.
   */
  function cancelDashboardDelete() {
    dashboardDeleteDialog.value = false
    dashboardToDelete.value = null
  }

  /**
   * Extracts stable KPI handles from template relations for direct dashboard creation.
   */

  /**
   * Persists KPI relations for a newly created dashboard through the generic reference endpoint.
   */
  async function createDashboardKpiReferences(
    dashboardHandle: NonNullable<DashboardItem['handle']>,
    kpiHandles: number[],
  ) {
    for (const kpiHandle of kpiHandles) {
      await ApiGenericService.createReference('dashboard', 'kpis', dashboardHandle, kpiHandle)
    }
  }

  /**
   * Persists KPI relations for a newly created dashboard template.
   */
  async function createDashboardTemplateKpiReferences(
    dashboardTemplateHandle: NonNullable<DashboardTemplateItem['handle']>,
    kpiHandles: number[],
  ) {
    for (const kpiHandle of kpiHandles) {
      await ApiGenericService.createReference(
        'dashboardTemplate',
        'kpis',
        dashboardTemplateHandle,
        kpiHandle,
      )
    }
  }
  // #endregion

  // #region Dialogs
  /**
   * Opens the dashboard creation dialog, optionally prefilled from a template.
   */
  function openDashboardDialog(item: DashboardItem | null = null) {
    dashboardDialog.value = { visible: true, mode: 'create', item }
  }

  /**
   * Closes the dashboard creation dialog.
   */
  function closeDashboardDialog() {
    dashboardDialog.value = { visible: false, mode: 'create', item: null }
  }

  /**
   * Opens the template creation dialog for the current dashboard.
   */
  function openDashboardTemplateSaveDialog() {
    if (!currentDashboard.value || !currentPersonStore.person) {
      return
    }

    dashboardTemplateDialog.value = {
      visible: true,
      mode: 'create',
      item: {
        name: currentDashboard.value.name,
        description: '',
        isShared: false,
        person: currentPersonStore.person,
        kpis: currentDashboard.value.kpis ?? [],
      },
    }
  }

  /**
   * Closes the template creation dialog.
   */
  function closeDashboardTemplateDialog() {
    dashboardTemplateDialog.value = { visible: false, mode: 'create', item: null }
  }

  /**
   * Opens the template picker dialog and refreshes templates beforehand.
   */
  async function openDashboardTemplateLoadDialog() {
    await loadAvailableDashboardTemplates()
    dashboardTemplateLoadDialog.value = true
  }

  function updateDashboardDialogVisibility(value: boolean) {
    dashboardDialog.value = { ...dashboardDialog.value, visible: value }
  }

  function updateDashboardDialogMode(value: EditDialogOptions['mode']) {
    dashboardDialog.value = { ...dashboardDialog.value, mode: value }
  }

  function updateDashboardDialogItem(value: SaplingGenericItem | null) {
    dashboardDialog.value = { ...dashboardDialog.value, item: value as DashboardItem | null }
  }

  function updateDashboardTemplateDialogVisibility(value: boolean) {
    dashboardTemplateDialog.value = { ...dashboardTemplateDialog.value, visible: value }
  }

  function updateDashboardTemplateDialogMode(value: EditDialogOptions['mode']) {
    dashboardTemplateDialog.value = { ...dashboardTemplateDialog.value, mode: value }
  }

  function updateDashboardTemplateDialogItem(value: SaplingGenericItem | null) {
    dashboardTemplateDialog.value = {
      ...dashboardTemplateDialog.value,
      item: value as DashboardTemplateItem | null,
    }
  }

  function updateDashboardTemplateLoadDialogVisibility(value: boolean) {
    dashboardTemplateLoadDialog.value = value
  }
  // #endregion

  // #region CRUD
  /**
   * Deletes the selected dashboard and updates the tab selection afterwards.
   */
  async function confirmDashboardDelete() {
    if (!dashboardToDelete.value || dashboardToDelete.value.handle == null) {
      cancelDashboardDelete()
      return
    }

    await ApiGenericService.delete('dashboard', dashboardToDelete.value.handle)

    const idx = dashboards.value.findIndex(
      (dashboard) => dashboard.handle === dashboardToDelete.value?.handle,
    )
    if (idx !== -1) {
      dashboards.value.splice(idx, 1)
    }

    syncActiveTab()
    cancelDashboardDelete()
  }

  /**
   * Persists a dashboard and keeps the dashboard list in sync afterwards.
   */
  async function onDashboardSave(
    form: DashboardForm,
    action: DialogSaveAction,
    context?: DialogSaveContext,
  ) {
    if (!currentPersonStore.person?.handle) {
      context?.complete()
      return
    }

    try {
      let pendingRelationsPersisted = true
      const formWithoutKpis = toDashboardPayload(form)
      const isEditing =
        dashboardDialog.value.mode === 'edit' && dashboardDialog.value.item?.handle != null
      const kpiHandles = Array.isArray(form.kpis)
        ? getKpiHandles(form)
        : isEditing && dashboardDialog.value.item
          ? getKpiHandles(dashboardDialog.value.item)
          : []
      let dashboard: DashboardItem
      const payload: DashboardPayload = {
        ...formWithoutKpis,
        person: currentPersonStore.person.handle,
        kpiOrder: kpiHandles,
      }

      if (isEditing && dashboardDialog.value.item?.handle != null) {
        dashboard = await ApiGenericService.update<DashboardItem>(
          'dashboard',
          dashboardDialog.value.item.handle,
          payload,
        )
      } else {
        dashboard = await ApiGenericService.create<DashboardItem>('dashboard', {
          ...payload,
          sortOrder: getNextDashboardSortOrder(dashboards.value),
        })
        if (dashboard.handle != null) {
          pendingRelationsPersisted =
            (await context?.persistPendingRelations?.(dashboard.handle)) ?? true
        }
        if (dashboard.handle != null) {
          await createDashboardKpiReferences(dashboard.handle, kpiHandles)
        }
      }

      await loadDashboards()

      const dashboardIndex = dashboards.value.findIndex(
        (entry) => entry.handle === dashboard.handle,
      )
      if (dashboardIndex !== -1) {
        activeTab.value = dashboardIndex
      }

      if (action === 'saveAndClose' && pendingRelationsPersisted) {
        closeDashboardDialog()
        return
      }

      dashboardDialog.value = {
        visible: true,
        mode: 'edit',
        item: dashboardIndex !== -1 ? dashboards.value[dashboardIndex] : dashboard,
      }
    } finally {
      context?.complete()
    }
  }

  /**
   * Persists the current dashboard as a reusable template.
   */
  async function onDashboardTemplateSave(
    form: DashboardForm,
    _action: DialogSaveAction,
    context?: DialogSaveContext,
  ) {
    if (!currentPersonStore.person?.handle) {
      context?.complete()
      return
    }

    try {
      const formWithoutKpis = toDashboardPayload(form)
      const payload: DashboardTemplatePayload = {
        ...formWithoutKpis,
        person: currentPersonStore.person.handle,
      }
      const dashboardTemplate = await ApiGenericService.create<DashboardTemplateItem>(
        'dashboardTemplate',
        payload,
      )

      const pendingRelationsPersisted =
        dashboardTemplate.handle == null
          ? true
          : ((await context?.persistPendingRelations?.(dashboardTemplate.handle)) ?? true)

      if (dashboardTemplate.handle != null) {
        await createDashboardTemplateKpiReferences(dashboardTemplate.handle, getKpiHandles(form))
      }

      await loadAvailableDashboardTemplates()
      if (pendingRelationsPersisted) {
        closeDashboardTemplateDialog()
      } else {
        dashboardTemplateDialog.value = {
          visible: true,
          mode: 'edit',
          item: dashboardTemplate,
        }
      }
      pushMessage(
        'success',
        'global.recordSaved',
        'global.recordSavedDescription',
        'dashboardTemplate',
      )
    } finally {
      context?.complete()
    }
  }

  /**
   * Opens the delete flow for the provided dashboard handle when more than one dashboard exists.
   */
  function removeDashboard(handle: NonNullable<DashboardItem['handle']>) {
    if (!isDashboardRemovable.value) {
      return
    }

    dashboardToDelete.value =
      dashboards.value.find((dashboard) => dashboard.handle === handle) || null
    dashboardDeleteDialog.value = dashboardToDelete.value !== null
  }

  /**
   * Creates a personal dashboard directly from the selected template including its KPIs.
   */
  async function loadDashboardFromTemplate(template: DashboardTemplateItem) {
    if (!currentPersonStore.person?.handle || template.handle == null) {
      return
    }

    applyingDashboardTemplateHandle.value = template.handle

    try {
      const dashboard = await ApiGenericService.create<DashboardItem>('dashboard', {
        name: template.name,
        person: currentPersonStore.person.handle,
        sortOrder: getNextDashboardSortOrder(dashboards.value),
        kpiOrder: getKpiHandles(template),
      })

      if (dashboard.handle != null) {
        const templateKpis = getKpiHandles(template)
        await createDashboardKpiReferences(dashboard.handle, templateKpis)
      }

      await loadDashboards()

      const dashboardIndex = dashboards.value.findIndex(
        (entry) => entry.handle === dashboard.handle,
      )
      if (dashboardIndex !== -1) {
        activeTab.value = dashboardIndex
      }

      dashboardTemplateLoadDialog.value = false
      pushMessage('success', 'global.recordSaved', 'global.recordSavedDescription', 'dashboard')
    } finally {
      applyingDashboardTemplateHandle.value = null
    }
  }
  // #endregion

  // #region UI Actions
  /**
   * Replaces the KPI collection for a single dashboard without reloading all dashboard data.
   */

  // #region Return
  return {
    dashboardDeleteDialog,
    dashboardToDelete,
    dashboardDialog,
    dashboardTemplateDialog,
    dashboardTemplateLoadDialog,
    applyingDashboardTemplateHandle,
    dashboardEntity,
    dashboardEntityTemplates,
    dashboardTemplateEntity,
    dashboardTemplateEntityTemplates,
    availableDashboardTemplates,
    isLoading,
    dashboards,
    activeTab,
    isLayoutEditing,
    isLayoutSaving,
    currentPersonStore,
    currentDashboard,
    hasDashboards,
    isDashboardRemovable,
    cancelDashboardDelete,
    closeDashboardDialog,
    closeDashboardTemplateDialog,
    openDashboardDialog,
    openDashboardTemplateLoadDialog,
    openDashboardTemplateSaveDialog,
    updateDashboardDialogVisibility,
    updateDashboardDialogMode,
    updateDashboardDialogItem,
    updateDashboardTemplateDialogVisibility,
    updateDashboardTemplateDialogMode,
    updateDashboardTemplateDialogItem,
    updateDashboardTemplateLoadDialogVisibility,
    confirmDashboardDelete,
    loadDashboardFromTemplate,
    onDashboardSave,
    onDashboardTemplateSave,
    removeDashboard,
    updateDashboardKpis,
    beginLayoutEdit,
    cancelLayoutEdit,
    reorderDashboards,
    saveLayout,
    loadDashboards,
    loadDashboardEntity,
    loadDashboardEntityTemplates,
    loadDashboardTemplateEntity,
    loadDashboardTemplateEntityTemplates,
    loadAvailableDashboardTemplates,
  }
  // #endregion
}
