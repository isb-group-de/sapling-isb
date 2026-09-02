// #region Imports
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ApiGenericService from '@/services/api.generic.service'
import { i18n } from '@/i18n'
import type { ColumnFilterItem, SaplingTableHeaderItem, SortItem } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { DEFAULT_PAGE_SIZE_MEDIUM, GENERIC_API_MAX_PAGE_SIZE } from '@/constants/project.constants'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useGenericStore } from '@/stores/genericStore'
import {
  buildTableOrderBy,
  getReadableReferenceRelationNames,
  getTableHeaders,
} from '@/utils/saplingTableUtil'
import { useSaplingTableFormConfig } from '@/composables/table/useSaplingTableFormConfig'
import { replaceSaplingTableUrlState } from '@/composables/table/saplingTableRouteState'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingTableProjection } from './useSaplingTableProjection'
import { useSaplingTableQueryState } from './useSaplingTableQueryState'
import { useSaplingTableControls } from './useSaplingTableControls'
import { useSaplingTableFilterRestoration } from './useSaplingTableFilterRestoration'
import { isAbortError } from './saplingTableData.utils'
// #endregion

const TABLE_LOAD_DEBOUNCE_MS = 250

type InitializeEntityStateOptions = {
  initialSearch?: string
  beforeInitialLoad?: (context?: SaplingTableInitialLoadContext) => Promise<void> | void
}

export type SaplingTableInitialLoadContext = {
  isDefaultWorklistReset: boolean
}

export type SaplingTableBehaviorOptions = {
  searchFieldNames?: string[]
  applyDefaultOpenChipFilters?: boolean
}

/**
 * Shared table state for entity-backed data tables.
 * Handles metadata loading, server pagination, sorting and column filtering.
 */
export function useSaplingTable(
  entityHandle: Ref<string>,
  itemsPerPageDefaultValue?: number,
  isUseQueryParameter?: boolean,
  autoInitialize = true,
  getInitializeEntityStateOptions: () => InitializeEntityStateOptions = () => ({}),
  additionalListProjectionFields: string[] = [],
  behaviorOptions: SaplingTableBehaviorOptions = {},
) {
  // #region State
  const items = ref<SaplingGenericItem[]>([])
  const search = ref('')
  const headers = ref<SaplingTableHeaderItem[]>([])
  const page = ref(1)
  const itemsPerPageDefault = ref(
    Math.min(
      Math.max(itemsPerPageDefaultValue ?? DEFAULT_PAGE_SIZE_MEDIUM, 1),
      GENERIC_API_MAX_PAGE_SIZE,
    ),
  )
  const itemsPerPage = ref(itemsPerPageDefault.value)
  const totalItems = ref(0)
  const sortBy = ref<SortItem[]>([])
  const columnFilters = ref<Record<string, ColumnFilterItem>>({})
  const parentFilter = ref<Record<string, unknown>>({})
  const isResettingEntityState = ref(false)
  const isInitialized = ref(false)
  const isDataLoading = ref(false)
  const temporaryVisibleColumnKeys = ref<string[]>([])
  const route = useRoute()
  const router = useRouter()
  const currentPermissionStore = useCurrentPermissionStore()
  const genericStore = useGenericStore()
  const { pushMessage } = useSaplingMessageCenter()
  let activeLoadController: AbortController | null = null
  let scheduledLoadTimeout: ReturnType<typeof setTimeout> | null = null
  let latestLoadRequestId = 0
  let latestInitializationId = 0
  let latestFormConfigSelectionId = 0
  let latestLoadedTableQuerySignature = ''
  let isResettingDefaultWorklist = false
  // #endregion

  // #region Entity Metadata
  const entity = computed(() => genericStore.getState(entityHandle.value).entity)
  const entityPermission = computed(
    () => genericStore.getState(entityHandle.value).entityPermission,
  )
  const formConfigContext = useSaplingTableFormConfig(
    entityHandle,
    () => genericStore.getState(entityHandle.value).entityTemplates,
  )
  const {
    entityTemplates,
    menuItems: formConfigMenuItems,
    selectedLabel: selectedFormConfigLabel,
    selectedFormConfigHandle,
    isLoadingFormConfigs,
    isSavingTableView,
  } = formConfigContext
  const {
    deletePersonalFormConfig,
    onColumnFiltersUpdate,
    onItemsPerPageUpdate,
    onPageUpdate,
    onSearchUpdate,
    onSortByUpdate,
    onVisibleColumnKeysUpdate,
    savePersonalTableView,
    selectFormConfig,
    setDefaultFormConfig,
  } = useSaplingTableControls({
    search,
    page,
    itemsPerPage,
    sortBy,
    columnFilters,
    temporaryVisibleColumnKeys,
    isResettingEntityState,
    formConfigContext,
  })
  const isLoading = computed(
    () => genericStore.getState(entityHandle.value).isLoading || isDataLoading.value,
  )
  const {
    buildListProjectionFields,
    listProjectionFields,
    preloadValueReferenceMetadata,
    readableReferenceRelations,
    referenceSearchTemplates,
  } = useSaplingTableProjection({
    entityTemplates,
    temporaryVisibleColumnKeys,
    additionalListProjectionFields,
    currentPermissionStore,
    genericStore,
  })
  // #endregion

  // #region Filters and Sorting
  const {
    activeFilter,
    getRouteState,
    initialSort,
    routeStateSignature,
    syncUrlState,
    tableQuerySignature,
    validSortBy,
  } = useSaplingTableQueryState({
    route,
    isUseQueryParameter,
    entityHandle,
    search,
    page,
    itemsPerPage,
    itemsPerPageDefault,
    sortBy,
    columnFilters,
    parentFilter,
    entityTemplates,
    referenceSearchTemplates,
    listProjectionFields,
    searchFieldNames: behaviorOptions.searchFieldNames,
  })
  // #endregion

  // #region Data Loading
  async function loadData(options?: {
    entityHandle?: string
    initializationId?: number
    projectionFields?: string[]
    projectionRelations?: string[]
  }) {
    const currentEntityHandle = options?.entityHandle ?? entityHandle.value
    const initializationId = options?.initializationId

    if (isResettingEntityState.value || !currentEntityHandle) {
      return
    }

    const currentTableQuerySignature = tableQuerySignature.value
    activeLoadController?.abort()
    const loadController = new AbortController()
    activeLoadController = loadController
    const requestId = ++latestLoadRequestId
    isDataLoading.value = true

    try {
      const result = await ApiGenericService.find<SaplingGenericItem>(currentEntityHandle, {
        filter: activeFilter.value,
        orderBy: buildTableOrderBy(validSortBy.value),
        page: page.value,
        limit: itemsPerPage.value,
        relations: options?.projectionRelations ?? readableReferenceRelations.value,
        fields: options?.projectionFields ?? listProjectionFields.value,
        signal: loadController.signal,
      })

      if (requestId !== latestLoadRequestId) {
        return
      }

      if (
        entityHandle.value !== currentEntityHandle ||
        (typeof initializationId === 'number' && initializationId !== latestInitializationId)
      ) {
        return
      }

      items.value = result.data
      totalItems.value = result.meta.total
      latestLoadedTableQuerySignature = currentTableQuerySignature
    } catch (error) {
      if (isAbortError(error)) {
        return
      }

      throw error
    } finally {
      if (activeLoadController === loadController) {
        activeLoadController = null
        isDataLoading.value = false
      }
    }
  }

  function cancelScheduledLoad() {
    if (scheduledLoadTimeout) {
      clearTimeout(scheduledLoadTimeout)
      scheduledLoadTimeout = null
    }
  }

  function scheduleLoadData() {
    cancelScheduledLoad()
    scheduledLoadTimeout = setTimeout(() => {
      scheduledLoadTimeout = null
      void loadData()
    }, TABLE_LOAD_DEBOUNCE_MS)
  }

  function generateHeaders(nextEntityHandle = entityHandle.value) {
    const nextEntity = genericStore.getState(nextEntityHandle).entity

    headers.value = getTableHeaders(
      entityTemplates.value,
      nextEntity,
      i18n.global.t,
      currentPermissionStore.accumulatedPermission ?? [],
    )
  }

  function resetEntityState() {
    const routeState = getRouteState()
    items.value = []
    totalItems.value = 0
    headers.value = []
    page.value = routeState.page
    if (routeState.itemsPerPage !== null) {
      itemsPerPage.value = routeState.itemsPerPage
    }
    search.value = routeState.search
    sortBy.value = []
    columnFilters.value = {}
    temporaryVisibleColumnKeys.value = []
  }

  const { applyDefaultOpenChipColumnFilters, restoreQueryFilterState } =
    useSaplingTableFilterRestoration({
      columnFilters,
      parentFilter,
      getRouteState,
      entityHandle,
      pushMessage,
      searchFieldNames: behaviorOptions.searchFieldNames,
    })

  async function initializeEntityState(options: InitializeEntityStateOptions = {}) {
    const currentEntityHandle = entityHandle.value
    const initializationId = ++latestInitializationId

    if (!currentEntityHandle) {
      return
    }

    isInitialized.value = false
    isResettingEntityState.value = true
    cancelScheduledLoad()
    formConfigContext.reset()
    activeLoadController?.abort()
    activeLoadController = null
    latestLoadRequestId += 1
    latestLoadedTableQuerySignature = ''
    isDataLoading.value = false
    resetEntityState()
    if (typeof options?.initialSearch === 'string') {
      search.value = options.initialSearch
    }

    try {
      await Promise.all([
        genericStore.loadGeneric(currentEntityHandle, 'global', 'filter', 'exception'),
        currentPermissionStore.fetchCurrentPermission(),
      ])

      if (
        initializationId !== latestInitializationId ||
        entityHandle.value !== currentEntityHandle
      ) {
        return
      }

      const nextEntityTemplates = entityTemplates.value
      await preloadValueReferenceMetadata(nextEntityTemplates)

      if (
        initializationId !== latestInitializationId ||
        entityHandle.value !== currentEntityHandle
      ) {
        return
      }

      generateHeaders(currentEntityHandle)
      initialSort(nextEntityTemplates)
      restoreQueryFilterState(nextEntityTemplates)
      if (behaviorOptions.applyDefaultOpenChipFilters !== false) {
        await applyDefaultOpenChipColumnFilters(nextEntityTemplates)
      }
      await options.beforeInitialLoad?.({ isDefaultWorklistReset: false })
    } finally {
      if (
        initializationId === latestInitializationId &&
        entityHandle.value === currentEntityHandle
      ) {
        isResettingEntityState.value = false
      }
    }

    if (initializationId !== latestInitializationId || entityHandle.value !== currentEntityHandle) {
      return
    }

    await loadData({
      entityHandle: currentEntityHandle,
      initializationId,
    })

    if (initializationId !== latestInitializationId || entityHandle.value !== currentEntityHandle) {
      return
    }

    isInitialized.value = true
    formConfigContext.scheduleLoad(
      currentEntityHandle,
      () =>
        initializationId === latestInitializationId && entityHandle.value === currentEntityHandle,
    )
  }
  // #endregion

  // #region Lifecycle and Watchers
  onMounted(() => {
    if (!autoInitialize) {
      return
    }

    void initializeEntityState(getInitializeEntityStateOptions())
  })

  onBeforeUnmount(() => {
    latestFormConfigSelectionId += 1
    cancelScheduledLoad()
    formConfigContext.cancelScheduledLoad()
    activeLoadController?.abort()
    activeLoadController = null
  })

  watch(tableQuerySignature, (nextSignature) => {
    if (isResettingEntityState.value || !isInitialized.value) {
      return
    }

    if (nextSignature === latestLoadedTableQuerySignature) {
      return
    }

    // Invalidate the old request immediately. Waiting for the debounced reload
    // would allow stale rows from the previous filter to reappear meanwhile.
    activeLoadController?.abort()
    activeLoadController = null
    latestLoadRequestId += 1
    isDataLoading.value = false
    scheduleLoadData()
    syncUrlState()
  })

  // Dialog routing and other page-level query parameters must not reset the
  // table. Reinitialize only when the entity or effective table URL state
  // (search, paging, sorting, filters) changes.
  watch([entityHandle, routeStateSignature], () => {
    if (isResettingDefaultWorklist) {
      return
    }

    if (!autoInitialize && !isInitialized.value) {
      return
    }

    void initializeEntityState(getInitializeEntityStateOptions())
  })

  watch(
    () => selectedFormConfigHandle.value,
    () => {
      if (isResettingEntityState.value || !isInitialized.value) {
        return
      }

      const selectionId = ++latestFormConfigSelectionId
      const currentEntityHandle = entityHandle.value
      const initializationId = latestInitializationId
      const nextEntityTemplates = entityTemplates.value

      void preloadValueReferenceMetadata(nextEntityTemplates)
        .catch(() => undefined)
        .then(() => {
          if (
            selectionId !== latestFormConfigSelectionId ||
            initializationId !== latestInitializationId ||
            entityHandle.value !== currentEntityHandle
          ) {
            return
          }

          generateHeaders()
          page.value = 1
          const projectionFields = buildListProjectionFields(nextEntityTemplates)
          const projectionRelations = getReadableReferenceRelationNames(
            nextEntityTemplates,
            currentPermissionStore.accumulatedPermission ?? [],
            projectionFields,
            (referenceName) => genericStore.getState(referenceName).entityTemplates,
          )

          cancelScheduledLoad()
          void loadData({ projectionFields, projectionRelations })
        })
    },
  )
  // #endregion

  // #region URL Sync
  /**
   * Persists user-controlled table state (search, page, itemsPerPage, sortBy, filter)
   * into the location bar via history.replaceState. We bypass vue-router's
   * `router.replace` here on purpose so the table route-state watcher does
   * not trigger a full re-initialization for our own writes — browser back/forward
   * still works because popstate updates the effective table route state.
   */
  // #endregion

  // #region Event Handlers

  /**
   * Restores only the worklist state. Personal/global column views stay selected.
   * The defaults match a direct route load: metadata ordering, open chip values,
   * and any workspace-specific defaults supplied by beforeInitialLoad.
   */
  async function resetToDefaultWorklist(): Promise<void> {
    if (!entityHandle.value || isResettingDefaultWorklist) {
      return
    }

    isResettingDefaultWorklist = true
    isResettingEntityState.value = true
    cancelScheduledLoad()
    activeLoadController?.abort()
    activeLoadController = null
    latestLoadRequestId += 1
    latestLoadedTableQuerySignature = ''
    isDataLoading.value = false

    try {
      search.value = ''
      page.value = 1
      itemsPerPage.value = itemsPerPageDefault.value
      sortBy.value = []
      columnFilters.value = {}
      parentFilter.value = {}

      initialSort(entityTemplates.value, false)
      if (behaviorOptions.applyDefaultOpenChipFilters !== false) {
        await applyDefaultOpenChipColumnFilters(entityTemplates.value)
      }
      await getInitializeEntityStateOptions().beforeInitialLoad?.({
        isDefaultWorklistReset: true,
      })

      const query = { ...route.query }
      ;['search', 'page', 'itemsPerPage', 'sortBy', 'filter'].forEach((key) => delete query[key])
      await router.replace({ path: route.path, query, hash: route.hash })
      await nextTick()

      replaceSaplingTableUrlState(
        {
          search: '',
          page: 1,
          itemsPerPage: itemsPerPageDefault.value,
          defaultItemsPerPage: itemsPerPageDefault.value,
          sortBy: [],
          filter: null,
        },
        Boolean(isUseQueryParameter),
      )
    } finally {
      isResettingEntityState.value = false
      isResettingDefaultWorklist = false
    }

    await loadData()
  }

  // #endregion

  // #region Return
  return {
    isLoading,
    items,
    entityTemplates,
    search,
    page,
    itemsPerPage,
    headers,
    totalItems,
    sortBy,
    columnFilters,
    activeFilter,
    entity,
    entityPermission,
    formConfigMenuItems,
    selectedFormConfigLabel,
    selectedFormConfigHandle,
    isLoadingFormConfigs,
    isSavingTableView,
    parentFilter,
    isInitialized,
    initializeEntityState,
    loadData,
    onSearchUpdate,
    onPageUpdate,
    onItemsPerPageUpdate,
    onColumnFiltersUpdate,
    onSortByUpdate,
    onVisibleColumnKeysUpdate,
    resetToDefaultWorklist,
    selectFormConfig,
    setDefaultFormConfig,
    deletePersonalFormConfig,
    savePersonalTableView,
    generateHeaders,
    initialSort,
  }
  // #endregion
}
