import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  AccumulatedPermission,
  ColumnFilterItem,
  DialogSaveAction,
  DialogSaveContext,
  EntityTemplate,
  SaplingTableHeaderItem,
  SortItem,
} from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { DEFAULT_SMALL_WINDOW_WIDTH } from '@/constants/project.constants'
import type { EntityItem, ScriptButtonItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useGenericStore } from '@/stores/genericStore'
import { getItemHandle } from '@/composables/table/saplingTableAction.utils'
import {
  canReadReferenceTemplate,
  filterTableHeadersByReferencePermission,
  getMobileTableHeaders,
  getSupportedTableHeaders,
  getTableHeaders,
} from '@/utils/saplingTableUtil'
import { useSaplingTableFilters } from '@/composables/table/useSaplingTableFilters'
import { useSaplingTableSelection } from '@/composables/table/useSaplingTableSelection'
import { useSaplingTableActions } from '@/composables/table/useSaplingTableActions'
import { useSaplingTableAutoRefresh } from '@/composables/table/useSaplingTableAutoRefresh'
import {
  placeTableColumnKey,
  removeTableColumnKey,
  selectTableColumns,
  type SaplingTableColumnMove,
} from '@/composables/table/saplingTableColumnOrder'

export interface UseSaplingTableProps {
  items: SaplingGenericItem[]
  parent?: SaplingGenericItem | null
  parentEntity?: EntityItem | null
  search: string
  showSearch?: boolean
  page: number
  itemsPerPage: number
  totalItems: number
  isLoading: boolean
  sortBy: SortItem[]
  entityHandle: string
  entity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  entityTemplates: EntityTemplate[]
  parentFilter?: Record<string, unknown>
  columnFilters?: Record<string, ColumnFilterItem>
  activeFilter?: FilterQuery
  showActions: boolean
  rowInteraction?: boolean
  tableKey: string
  headers?: SaplingTableHeaderItem[]
  multiSelect?: boolean
  disableMobileView?: boolean
  scriptButtons?: ScriptButtonItem[]
  selected?: SaplingGenericItem[]
  isOpenEditDialog?: boolean
  openEditHandle?: string | number | null
  isInitialized?: boolean
  deferCreate?: boolean
  allowDeleteActions?: boolean
}

export type UseSaplingTableEmit = {
  (event: 'update:search', value: string): void
  (event: 'update:page', value: number): void
  (event: 'update:itemsPerPage', value: number): void
  (event: 'update:sortBy', value: SortItem[]): void
  (event: 'update:columnFilters', value: Record<string, ColumnFilterItem>): void
  (event: 'reload'): void
  (event: 'update:selected', value: SaplingGenericItem[]): void
  (event: 'update:visibleColumnKeys', value: string[]): void
  (
    event: 'createDraft',
    value: SaplingGenericItem,
    action: DialogSaveAction,
    context?: DialogSaveContext,
  ): void
}

const MOBILE_TABLE_BREAKPOINT = DEFAULT_SMALL_WINDOW_WIDTH
const COMPACT_TOOLBAR_BREAKPOINT = 760
const PRELOAD_REFERENCE_KINDS = ['m:1', '1:1']
const REFERENCE_PRELOAD_DELAY_MS = 150

/**
 * Encapsulates the local UI workflow for the shared data table.
 * Keeps dialog, selection and column filter state out of the component template.
 */
export function useSaplingTableComponent(props: UseSaplingTableProps, emit: UseSaplingTableEmit) {
  // #region State
  const { t } = useI18n()
  const currentPermissionStore = useCurrentPermissionStore()
  const genericStore = useGenericStore()

  const {
    localColumnFilters,
    onSearchUpdate,
    onPageUpdate,
    onItemsPerPageUpdate,
    onSortByUpdate,
    toggleColumnSort,
    getColumnSortIcon,
    onColumnFilterChange,
    getColumnFilterItem,
    getFilterOperatorOptions,
    isColumnFilterable,
  } = useSaplingTableFilters(props, emit)
  const { selectedItems, selectedRows, selectedRow, selectAllRows, selectRow, clearSelection } =
    useSaplingTableSelection(props, emit)
  const {
    multiSelectScriptButtons,
    rowScriptButtons,
    canNavigate,
    canShowInformation,
    editDialog,
    deleteDialog,
    bulkDeleteDialog,
    bulkUpdateDialog,
    updateConflictDialog,
    showUploadDialog,
    uploadDialogItem,
    showInformationDialog,
    informationDialogItem,
    showExternalRecordLinksDialog,
    externalRecordLinksDialogItem,
    contextMenu,
    contextMenuMailActions,
    favoriteDialog,
    currentEntityFavorites,
    isCurrentEntityFavoritesLoading,
    activeFavoriteHandle,
    isDownloadingJSON,
    isImportingCSV,
    downloadJSON,
    exportCSV,
    exportCSVTemplate,
    importCSVFile,
    refreshTable: reloadTable,
    exportSelectedJSON,
    openContextMenu,
    closeContextMenu,
    onContextMenuAction,
    navigateToAddress,
    openTimeline,
    openChangeLog,
    openUploadDialog,
    closeUploadDialog,
    navigateToDocuments,
    openInformationDialog,
    closeInformationDialog,
    openExternalRecordLinksDialog,
    closeExternalRecordLinksDialog,
    openFavoriteDialog,
    closeFavoriteDialog,
    saveFavorite,
    selectFavorite,
    openCreateDialog,
    openEditDialog,
    openShowDialog,
    openCopyDialog,
    closeDialog,
    saveDialog,
    closeUpdateConflictDialog,
    openUpdateConflictChangeLog,
    reloadUpdateConflictRecord,
    mergeUpdateConflict,
    confirmDelete,
    openDeleteDialog,
    closeDeleteDialog,
    deleteAllSelected,
    confirmBulkDelete,
    closeBulkDeleteDialog,
    openBulkUpdateDialog,
    closeBulkUpdateDialog,
    applyBulkUpdate,
    runSelectionScriptButton,
    runRowScriptButton,
  } = useSaplingTableActions({
    props,
    emit,
    localColumnFilters,
    selectedItems,
    selectedRows,
    clearSelection,
  })
  const {
    autoRefreshIntervalMinutes,
    secondsUntilRefresh,
    setAutoRefreshInterval,
    restartAutoRefreshTimer,
  } = useSaplingTableAutoRefresh(
    reloadTable,
    () =>
      props.isLoading ||
      (editDialog.value.visible && ['create', 'edit'].includes(editDialog.value.mode)),
  )
  const initialEditDialogShown = ref(false)
  const lastAutoOpenedEditKey = ref<string | null>(null)
  const tableContainerRef = ref<HTMLElement | null>(null)
  const manualColumnOrder = ref<string[] | null>(null)
  const windowWidth = ref(
    typeof window === 'undefined' ? MOBILE_TABLE_BREAKPOINT : window.innerWidth,
  )

  let referencePreloadTimeout: ReturnType<typeof setTimeout> | null = null

  const handleWindowResize = () => {
    windowWidth.value = window.innerWidth
  }

  const isMobileTable = computed(
    () => !props.disableMobileView && windowWidth.value < MOBILE_TABLE_BREAKPOINT,
  )
  const showToolbarActionsInline = computed(() => windowWidth.value >= COMPACT_TOOLBAR_BREAKPOINT)
  const currentPermissions = computed(() => currentPermissionStore.accumulatedPermission ?? [])

  function refreshTable(): void {
    reloadTable()
    restartAutoRefreshTimer()
  }
  // #endregion

  // #region Lifecycle
  onMounted(() => {
    window.addEventListener('resize', handleWindowResize)
    handleWindowResize()
    void currentPermissionStore.fetchCurrentPermission()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleWindowResize)
    cancelReferencePreload()
  })
  // #endregion

  // #region Shared Reference Metadata
  async function preloadReferenceData() {
    await currentPermissionStore.fetchCurrentPermission()

    const referenceNames = Array.from(
      new Set(
        props.entityTemplates
          .filter(
            (template) =>
              PRELOAD_REFERENCE_KINDS.includes(template.kind ?? '') &&
              template.referenceName &&
              canReadReferenceTemplate(template, currentPermissions.value),
          )
          .map((template) => template.referenceName as string),
      ),
    )

    if (referenceNames.length === 0) {
      return
    }

    await genericStore.loadGenericMany(
      referenceNames.map((referenceName) => ({
        entityHandle: referenceName,
        namespaces: ['global'],
      })),
    )
  }

  function cancelReferencePreload() {
    if (referencePreloadTimeout) {
      clearTimeout(referencePreloadTimeout)
      referencePreloadTimeout = null
    }
  }

  function scheduleReferencePreload() {
    cancelReferencePreload()
    referencePreloadTimeout = setTimeout(() => {
      referencePreloadTimeout = null
      void preloadReferenceData()
    }, REFERENCE_PRELOAD_DELAY_MS)
  }
  // #endregion

  // #region Watchers
  watch(
    () =>
      [
        props.items,
        props.isOpenEditDialog,
        props.openEditHandle,
        props.entityHandle,
        props.isInitialized,
      ] as const,
    ([items, isOpenEditDialog, openEditHandle, entityHandle, isInitialized]) => {
      const requestedHandle = normalizeOpenEditHandle(openEditHandle)
      if (requestedHandle && entityHandle && isInitialized !== false) {
        const autoOpenKey = `${entityHandle}:${requestedHandle}`
        if (lastAutoOpenedEditKey.value !== autoOpenKey) {
          const matchingItem =
            items.find((item) => String(getItemHandle(item) ?? '') === requestedHandle) ??
            ({ handle: requestedHandle } as SaplingGenericItem)

          lastAutoOpenedEditKey.value = autoOpenKey
          void openEditDialog(matchingItem)
        }

        initialEditDialogShown.value = true
        return
      }

      if (
        isOpenEditDialog &&
        Array.isArray(items) &&
        items.length > 0 &&
        !editDialog.value.visible &&
        !initialEditDialogShown.value
      ) {
        const firstItem = items[0]
        if (firstItem) {
          void openEditDialog(firstItem)
        }
        initialEditDialogShown.value = true
      }

      if (!isOpenEditDialog && !requestedHandle) {
        initialEditDialogShown.value = false
        lastAutoOpenedEditKey.value = null
      }
    },
    { immediate: true },
  )

  watch(
    () =>
      props.entityTemplates
        .map((template) => `${template.referenceName ?? ''}:${template.kind ?? ''}`)
        .join('|'),
    () => {
      scheduleReferencePreload()
    },
    { immediate: true },
  )

  watch(
    () => props.tableKey,
    () => {
      setAutoRefreshInterval(null)
      resetColumnOrder()
    },
  )

  watch(
    () => props.entityTemplates,
    () => resetColumnOrder(),
  )
  // #endregion

  // #region Computed
  const supportedTableHeaders = computed<SaplingTableHeaderItem[]>(() => {
    if (props.headers?.length) {
      return filterTableHeadersByReferencePermission(props.headers, currentPermissions.value)
    }

    return getSupportedTableHeaders(
      props.entityTemplates,
      props.entity,
      t,
      currentPermissions.value,
    )
  })

  const tableHeaders = computed<SaplingTableHeaderItem[]>(() => {
    if (props.headers?.length) {
      return supportedTableHeaders.value
    }

    return getTableHeaders(props.entityTemplates, props.entity, t, currentPermissions.value)
  })

  const dataHeaders = computed(() =>
    tableHeaders.value.filter((header) => header.key !== '__select' && header.key !== '__actions'),
  )

  const selectableDataHeaders = computed(() =>
    supportedTableHeaders.value.filter(
      (header) => header.key !== '__select' && header.key !== '__actions',
    ),
  )
  const configuredColumnKeys = computed(() => dataHeaders.value.map((header) => String(header.key)))
  const effectiveColumnKeys = computed(() =>
    manualColumnOrder.value === null ? configuredColumnKeys.value : manualColumnOrder.value,
  )
  const orderedDataHeaders = computed(() =>
    selectTableColumns(selectableDataHeaders.value, effectiveColumnKeys.value),
  )
  const orderedColumnKeys = computed(() =>
    orderedDataHeaders.value.map((header) => String(header.key)),
  )
  const selectableColumnKeys = computed(() =>
    selectableDataHeaders.value.map((header) => String(header.key)),
  )
  const visibleColumnKeySet = computed(() => new Set(orderedColumnKeys.value))
  const availableColumnHeaders = computed(() =>
    selectableDataHeaders.value.filter(
      (header) => !visibleColumnKeySet.value.has(String(header.key)),
    ),
  )
  const hasManualColumnOrder = computed(() => manualColumnOrder.value !== null)

  function setManualColumnOrder(nextOrder: string[]): void {
    manualColumnOrder.value = [...new Set(nextOrder)]
    emit('update:visibleColumnKeys', manualColumnOrder.value)
  }

  function moveColumn(move: SaplingTableColumnMove): void {
    const nextOrder = placeTableColumnKey(orderedColumnKeys.value, move)
    if (nextOrder.join('|') === orderedColumnKeys.value.join('|')) {
      return
    }

    setManualColumnOrder(nextOrder)
  }

  function addColumn(columnKey: string): void {
    if (
      !selectableColumnKeys.value.includes(columnKey) ||
      orderedColumnKeys.value.includes(columnKey)
    ) {
      return
    }

    setManualColumnOrder([...orderedColumnKeys.value, columnKey])
  }

  function removeColumn(columnKey: string): void {
    const nextOrder = removeTableColumnKey(orderedColumnKeys.value, columnKey)
    if (nextOrder.join('|') === orderedColumnKeys.value.join('|')) {
      return
    }

    setManualColumnOrder(nextOrder)
  }

  function resetColumnOrder(): void {
    manualColumnOrder.value = null
    emit('update:visibleColumnKeys', configuredColumnKeys.value)
  }

  const mobileCardHeaders = computed<SaplingTableHeaderItem[]>(() => {
    const mobileSourceHeaders = props.headers?.length
      ? dataHeaders.value
      : supportedTableHeaders.value.filter(
          (header) => header.key !== '__select' && header.key !== '__actions',
        )

    return getMobileTableHeaders(mobileSourceHeaders)
  })

  const visibleHeaders = computed<SaplingTableHeaderItem[]>(() => {
    let headers = orderedDataHeaders.value.map((header) =>
      withCellClass(header, 'sapling-table__cell--data'),
    )

    if (props.multiSelect) {
      headers = [
        withCellClass(
          { key: '__select', title: '', name: '__select', type: 'select' },
          'sapling-table__cell--select',
        ),
        ...headers,
      ]
    }

    if (props.showActions) {
      headers = [
        ...headers,
        withCellClass(
          { key: '__actions', title: '', name: '__actions', type: 'actions' },
          'sapling-table__cell--actions',
        ),
      ]
    }

    return headers
  })
  // #endregion

  // #region Return
  return {
    tableContainerRef,
    selectedRows,
    selectedRow,
    selectedItems,
    localColumnFilters,
    visibleHeaders,
    orderedColumnKeys,
    selectableColumnKeys,
    availableColumnHeaders,
    hasManualColumnOrder,
    mobileCardHeaders,
    canNavigate,
    canShowInformation,
    editDialog,
    deleteDialog,
    bulkDeleteDialog,
    bulkUpdateDialog,
    updateConflictDialog,
    showUploadDialog,
    uploadDialogItem,
    showInformationDialog,
    informationDialogItem,
    showExternalRecordLinksDialog,
    externalRecordLinksDialogItem,
    contextMenu,
    contextMenuMailActions,
    favoriteDialog,
    currentEntityFavorites,
    isCurrentEntityFavoritesLoading,
    activeFavoriteHandle,
    isDownloadingJSON,
    isImportingCSV,
    showToolbarActionsInline,
    isMobileTable,
    autoRefreshIntervalMinutes,
    secondsUntilRefresh,
    multiSelectScriptButtons,
    rowScriptButtons,
    onSearchUpdate,
    onPageUpdate,
    onItemsPerPageUpdate,
    onSortByUpdate,
    toggleColumnSort,
    getColumnSortIcon,
    onColumnFilterChange,
    getColumnFilterItem,
    getFilterOperatorOptions,
    isColumnFilterable,
    moveColumn,
    addColumn,
    removeColumn,
    resetColumnOrder,
    downloadJSON,
    exportCSV,
    exportCSVTemplate,
    importCSVFile,
    refreshTable,
    setAutoRefreshInterval,
    exportSelectedJSON,
    openContextMenu,
    closeContextMenu,
    onContextMenuAction,
    selectAllRows,
    selectRow,
    clearSelection,
    deleteAllSelected,
    confirmBulkDelete,
    closeBulkDeleteDialog,
    openBulkUpdateDialog,
    closeBulkUpdateDialog,
    applyBulkUpdate,
    runSelectionScriptButton,
    runRowScriptButton,
    navigateToAddress,
    openTimeline,
    openChangeLog,
    openUploadDialog,
    closeUploadDialog,
    navigateToDocuments,
    openInformationDialog,
    closeInformationDialog,
    openExternalRecordLinksDialog,
    closeExternalRecordLinksDialog,
    openFavoriteDialog,
    closeFavoriteDialog,
    saveFavorite,
    selectFavorite,
    openCreateDialog,
    openEditDialog,
    openShowDialog,
    openCopyDialog,
    closeDialog,
    saveDialog,
    closeUpdateConflictDialog,
    openUpdateConflictChangeLog,
    reloadUpdateConflictRecord,
    mergeUpdateConflict,
    confirmDelete,
    openDeleteDialog,
    closeDeleteDialog,
  }
  // #endregion
}

function withCellClass(header: SaplingTableHeaderItem, className: string): SaplingTableHeaderItem {
  const existingCellProps =
    typeof header.cellProps === 'object' && header.cellProps !== null
      ? (header.cellProps as Record<string, unknown>)
      : {}
  const existingClass =
    typeof existingCellProps.class === 'string' ? existingCellProps.class.trim() : ''

  return {
    ...header,
    cellProps: {
      ...existingCellProps,
      class: [existingClass, className].filter(Boolean).join(' '),
    },
  }
}

function normalizeOpenEditHandle(value: string | number | null | undefined): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}
