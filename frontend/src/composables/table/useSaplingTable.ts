// #region Imports
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import ApiGenericService from '@/services/api.generic.service'
import type { FilterQuery } from '@/services/api.generic.service'
import { i18n } from '@/i18n'
import type {
  ColumnFilterItem,
  EntityTemplate,
  SaplingTableHeaderItem,
  SortItem,
} from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import { DEFAULT_PAGE_SIZE_MEDIUM, GENERIC_API_MAX_PAGE_SIZE } from '@/constants/project.constants'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useGenericStore } from '@/stores/genericStore'
import {
  extractColumnFiltersFromFilterQuery,
  removeMatchingFilterFromFilterQuery,
  removeRestoredColumnFiltersFromFilterQuery,
  removeUnavailableFieldFilters,
} from '@/composables/table/useSaplingTableFilterHelpers'
import {
  buildTableFilter,
  buildTableOrderBy,
  canReadReferenceTemplate,
  getListProjectionFieldNames,
  getListProjectionReferenceDependencyNames,
  getReadableReferenceRelationNames,
  getReferenceChipProjectionFieldNames,
  getTableHeaders,
  isFilterableTableColumn,
  isTextSearchableTemplate,
} from '@/utils/saplingTableUtil'
import { useSaplingTableFormConfig } from '@/composables/table/useSaplingTableFormConfig'
import {
  getSaplingTableRouteStateSignature,
  readSaplingTableRouteState,
  replaceSaplingTableUrlState,
} from '@/composables/table/saplingTableRouteState'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
// #endregion

const TABLE_LOAD_DEBOUNCE_MS = 250
const TABLE_VALUE_REFERENCE_KINDS = ['m:1', '1:1']

type InitializeEntityStateOptions = {
  initialSearch?: string
  beforeInitialLoad?: () => Promise<void> | void
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
  const currentPermissionStore = useCurrentPermissionStore()
  const genericStore = useGenericStore()
  const { pushMessage } = useSaplingMessageCenter()
  let activeLoadController: AbortController | null = null
  let scheduledLoadTimeout: ReturnType<typeof setTimeout> | null = null
  let latestLoadRequestId = 0
  let latestInitializationId = 0
  let latestFormConfigSelectionId = 0
  let latestLoadedTableQuerySignature = ''
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
    setPersonalDefault,
  } = formConfigContext
  const isLoading = computed(
    () => genericStore.getState(entityHandle.value).isLoading || isDataLoading.value,
  )
  function buildListProjectionFields(nextEntityTemplates: EntityTemplate[]) {
    const permissions = currentPermissionStore.accumulatedPermission ?? []
    const baseFields = [
      ...new Set([
        ...getListProjectionFieldNames(
          nextEntityTemplates,
          permissions,
          (referenceName) => genericStore.getState(referenceName).entityTemplates,
        ),
        ...nextEntityTemplates
          .filter(
            (template) =>
              template.name === 'updatedAt' &&
              template.isPersistent !== false &&
              template.fieldAccess?.allowRead !== false,
          )
          .map((template) => template.name),
        ...additionalListProjectionFields.filter((fieldName) =>
          nextEntityTemplates.some(
            (template) => template.name === fieldName && template.fieldAccess?.allowRead !== false,
          ),
        ),
        ...temporaryVisibleColumnKeys.value.filter((fieldName) =>
          nextEntityTemplates.some(
            (template) =>
              template.name === fieldName &&
              template.isPersistent !== false &&
              template.fieldAccess?.allowRead !== false,
          ),
        ),
      ]),
    ]

    return [
      ...new Set([
        ...baseFields,
        ...getReferenceChipProjectionFieldNames(
          nextEntityTemplates,
          permissions,
          baseFields,
          (referenceName) => genericStore.getState(referenceName).entityTemplates,
        ),
      ]),
    ]
  }
  const listProjectionFields = computed(() => buildListProjectionFields(entityTemplates.value))
  const readableReferenceRelations = computed(() =>
    getReadableReferenceRelationNames(
      entityTemplates.value,
      currentPermissionStore.accumulatedPermission ?? [],
      listProjectionFields.value,
      (referenceName) => genericStore.getState(referenceName).entityTemplates,
    ),
  )
  const referenceSearchTemplates = computed(() =>
    Object.fromEntries(
      readableReferenceRelations.value
        .filter((relationName) => !relationName.includes('.'))
        .map((relationName) => {
          const referenceName = entityTemplates.value.find(
            (template) => template.name === relationName,
          )?.referenceName

          return referenceName
            ? [relationName, genericStore.getState(referenceName).entityTemplates]
            : null
        })
        .filter(
          (entry): entry is [string, EntityTemplate[]] => entry !== null && entry[1].length > 0,
        ),
    ),
  )
  // #endregion

  // #region Filters and Sorting
  const getRouteState = () => readSaplingTableRouteState(route.query, Boolean(isUseQueryParameter))
  const routeStateSignature = computed(() =>
    getSaplingTableRouteStateSignature(route.query, Boolean(isUseQueryParameter)),
  )

  const activeFilter = computed(() =>
    buildTableFilter({
      search: search.value,
      columnFilters: columnFilters.value,
      entityTemplates: entityTemplates.value,
      referenceSearchTemplates: referenceSearchTemplates.value,
      parentFilter: parentFilter.value,
    }),
  )
  const urlFilter = computed(() =>
    buildTableFilter({
      columnFilters: columnFilters.value,
      entityTemplates: entityTemplates.value,
      parentFilter: parentFilter.value,
    }),
  )

  const validSortBy = computed(() => {
    const validTemplateKeys = new Set(
      entityTemplates.value
        .filter(
          (template) =>
            template.isPersistent !== false && template.fieldAccess?.allowRead !== false,
        )
        .map((template) => template.name),
    )
    return sortBy.value.filter((sortItem) => validTemplateKeys.has(sortItem.key))
  })

  // Stable serialization of the dynamic query inputs. Watching this avoids
  // `deep: true` traversal on every keystroke and only fires the reload when
  // the effective filter/sort/pagination payload truly changes.
  const tableQuerySignature = computed(() =>
    JSON.stringify({
      entityHandle: entityHandle.value,
      search: search.value,
      page: page.value,
      itemsPerPage: itemsPerPage.value,
      sortBy: validSortBy.value,
      filter: activeFilter.value,
      fields: listProjectionFields.value,
    }),
  )

  /**
   * Applies the first template-defined default ordering to the server query.
   */
  function initialSort(nextEntityTemplates = entityTemplates.value) {
    const urlSortBy = getRouteState().sortBy
    if (urlSortBy.length > 0) {
      sortBy.value = urlSortBy
      return
    }

    const orderColumn = nextEntityTemplates.find(
      (template) =>
        template.fieldAccess?.allowRead !== false &&
        Array.isArray(template.options) &&
        (template.options.includes('isOrderASC') || template.options.includes('isOrderDESC')),
    )

    if (!orderColumn || !Array.isArray(orderColumn.options)) {
      sortBy.value = []
      return
    }

    sortBy.value = [
      {
        key: orderColumn.name,
        order: orderColumn.options.includes('isOrderDESC') ? 'desc' : 'asc',
      },
    ]
  }
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

  function restoreQueryFilterState(nextEntityTemplates: EntityTemplate[]) {
    const routeState = getRouteState()
    const sanitizedRouteFilter = removeUnavailableFieldFilters(
      routeState.filter,
      nextEntityTemplates,
    )
    const routeFilter = sanitizedRouteFilter.filter ?? {}
    if (sanitizedRouteFilter.removed) {
      pushMessage(
        'info',
        i18n.global.t('permission.filterAdjusted'),
        i18n.global.t('permission.filterAdjustedDescription'),
        entityHandle.value,
      )
    }
    const searchFilters = buildRouteSearchFilterCandidates(routeState.search, nextEntityTemplates)
    const filterWithoutSearch = searchFilters.reduce<unknown>(
      (filter, searchFilter) => removeMatchingFilterFromFilterQuery(filter, searchFilter),
      routeFilter,
    )

    columnFilters.value = extractColumnFiltersFromFilterQuery(nextEntityTemplates, routeFilter)
    parentFilter.value =
      removeRestoredColumnFiltersFromFilterQuery(nextEntityTemplates, filterWithoutSearch) ?? {}
  }

  async function applyDefaultOpenChipColumnFilters(nextEntityTemplates: EntityTemplate[]) {
    const chipReferenceTemplates = nextEntityTemplates.filter(isOpenChipReferenceTemplate)

    if (chipReferenceTemplates.length === 0) {
      return
    }

    const defaultFilters = await Promise.all(
      chipReferenceTemplates.map((template) => buildDefaultOpenChipColumnFilter(template)),
    )

    defaultFilters.forEach((filter) => {
      if (!filter || columnFilters.value[filter.key]) {
        return
      }

      columnFilters.value = {
        ...columnFilters.value,
        [filter.key]: filter.value,
      }
    })
  }

  async function preloadValueReferenceMetadata(nextEntityTemplates: EntityTemplate[]) {
    const permissions = currentPermissionStore.accumulatedPermission ?? []
    const projectedFields = getListProjectionFieldNames(nextEntityTemplates, permissions)
    const rootRelations = [
      ...new Set([
        ...getReadableReferenceRelationNames(nextEntityTemplates, permissions, projectedFields),
        ...getListProjectionReferenceDependencyNames(nextEntityTemplates, permissions),
      ]),
    ]
    const rootRelationSet = new Set(rootRelations)
    const rootReferenceNames = [
      ...new Set(
        nextEntityTemplates
          .filter(
            (template) => rootRelationSet.has(template.name) && Boolean(template.referenceName),
          )
          .map((template) => template.referenceName as string),
      ),
    ]

    await Promise.all(
      rootReferenceNames.map((referenceName) => genericStore.loadGeneric(referenceName, 'global')),
    )

    const nestedValueReferenceNames = [
      ...new Set(
        rootReferenceNames.flatMap((referenceName) =>
          genericStore
            .getState(referenceName)
            .entityTemplates.filter(
              (template) =>
                TABLE_VALUE_REFERENCE_KINDS.includes(template.kind ?? '') &&
                template.options?.includes('isValue') &&
                template.fieldAccess?.allowRead !== false &&
                canReadReferenceTemplate(template, permissions) &&
                Boolean(template.referenceName),
            )
            .map((template) => template.referenceName as string),
        ),
      ),
    ]

    await Promise.all(
      nestedValueReferenceNames.map((referenceName) =>
        genericStore.loadGeneric(referenceName, 'global'),
      ),
    )
  }

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
      await applyDefaultOpenChipColumnFilters(nextEntityTemplates)
      await options.beforeInitialLoad?.()
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
  function syncUrlState() {
    replaceSaplingTableUrlState(
      {
        search: search.value,
        page: page.value,
        itemsPerPage: itemsPerPage.value,
        defaultItemsPerPage: itemsPerPageDefault.value,
        sortBy: validSortBy.value,
        filter: urlFilter.value,
      },
      Boolean(isUseQueryParameter),
    )
  }
  // #endregion

  // #region Event Handlers
  function onSearchUpdate(value: string) {
    if (isResettingEntityState.value) {
      return
    }

    search.value = value
    page.value = 1
  }

  function onPageUpdate(value: number) {
    if (isResettingEntityState.value) {
      return
    }

    page.value = value
  }

  function onItemsPerPageUpdate(value: number) {
    if (isResettingEntityState.value) {
      return
    }

    itemsPerPage.value = Math.min(Math.max(value, 1), GENERIC_API_MAX_PAGE_SIZE)
    page.value = 1
  }

  function onColumnFiltersUpdate(value: Record<string, ColumnFilterItem>) {
    if (isResettingEntityState.value) {
      return
    }

    columnFilters.value = { ...value }
    page.value = 1
  }

  function onSortByUpdate(value: SortItem[]) {
    if (isResettingEntityState.value) {
      return
    }

    sortBy.value = value
  }

  function onVisibleColumnKeysUpdate(value: string[]) {
    temporaryVisibleColumnKeys.value = [...new Set(value.filter(Boolean))]
  }

  function selectFormConfig(handle: number | null): void {
    temporaryVisibleColumnKeys.value = []
    formConfigContext.select(handle)
  }

  async function setDefaultFormConfig(handle: number): Promise<void> {
    temporaryVisibleColumnKeys.value = []
    await setPersonalDefault(handle)
  }

  async function savePersonalTableView(
    name: string,
    orderedColumnKeys: string[],
    selectableColumnKeys: string[],
  ) {
    const savedConfig = await formConfigContext.savePersonalTableView(
      name,
      orderedColumnKeys,
      selectableColumnKeys,
    )
    temporaryVisibleColumnKeys.value = []
    return savedConfig
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
    selectFormConfig,
    setDefaultFormConfig,
    savePersonalTableView,
    generateHeaders,
    initialSort,
  }
  // #endregion
}

function buildRouteSearchFilterCandidates(
  search: string,
  entityTemplates: EntityTemplate[],
): FilterQuery[] {
  const normalizedSearch = search.trim()
  if (!normalizedSearch) {
    return []
  }

  const currentSearchFilter = buildTableFilter({ search, entityTemplates })
  const searchableTemplates = entityTemplates
    .filter(isFilterableTableColumn)
    .filter(isTextSearchableTemplate)
  const legacySearchFilter: FilterQuery = searchableTemplates.length
    ? {
        $or: searchableTemplates.map((template) => ({
          [template.name]: { $ilike: `%${normalizedSearch}%` },
        })),
      }
    : {}

  return [currentSearchFilter, legacySearchFilter]
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_CANCELED'
  )
}

function isOpenChipReferenceTemplate(template: EntityTemplate): boolean {
  return (
    template.kind === 'm:1' &&
    Boolean(template.referenceName) &&
    template.options?.includes('isChip') === true
  )
}

async function buildDefaultOpenChipColumnFilter(
  template: EntityTemplate,
): Promise<{ key: string; value: ColumnFilterItem } | null> {
  const referenceName = template.referenceName
  if (!referenceName) {
    return null
  }

  let referenceItems: SaplingGenericItem[]
  try {
    referenceItems = await ApiGenericService.findAll<SaplingGenericItem>(referenceName)
  } catch {
    return null
  }

  if (!referenceItems.some((item) => typeof item.isOpen === 'boolean')) {
    return null
  }

  const openItems = referenceItems.filter((item) => item.isOpen !== false)
  if (openItems.length === 0 || openItems.length === referenceItems.length) {
    return null
  }

  const relationItems = openItems
    .map((item): SaplingGenericItem | null => {
      const value = item.handle
      return typeof value === 'string' || typeof value === 'number' ? { handle: value } : null
    })
    .filter((item): item is SaplingGenericItem => item !== null)

  if (relationItems.length === 0) {
    return null
  }

  return {
    key: template.key ?? template.name,
    value: {
      operator: 'eq',
      value: '',
      relationItems,
    },
  }
}
