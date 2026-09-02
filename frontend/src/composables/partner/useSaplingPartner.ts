import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import { useSaplingChipFilters } from '@/composables/filter/useSaplingChipFilters'
import type { SaplingChipFilterSelection } from '@/components/filter/saplingWorkFilter.types'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { readSaplingTableRouteState } from '@/composables/table/saplingTableRouteState'
import type { SaplingTableInitialLoadContext } from '@/composables/table/useSaplingTable'
import {
  arePartnerColumnFiltersEqual,
  areSelectionsEqual,
  buildChipColumnFilterFromSelection,
  buildPartnerFilter,
  cloneFilter,
  combinePartnerFilters,
  extractPartnerHandlesFromFilter,
  getChipSelectionFromColumnFilter,
  normalizePartnerHandles,
  removePartnerSelectionFilter,
} from './saplingPartnerFilters'

export {
  arePartnerColumnFiltersEqual,
  buildChipColumnFilterFromSelection,
  combinePartnerFilters,
  extractPartnerHandlesFromFilter,
  getChipSelectionFromColumnFilter,
  removePartnerSelectionFilter,
} from './saplingPartnerFilters'

type PartnerHandle = number

function isFilterRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Centralizes table state and partner-specific filter logic for the partner screen.
 * The component remains template-focused while this composable owns entity changes,
 * selected people normalization and partner filter generation.
 */
export function useSaplingPartner(entityHandle: Ref<string>) {
  //#region State
  const route = useRoute()
  const currentPersonStore = useCurrentPersonStore()
  const selectedPeopleHandles = ref<PartnerHandle[]>([])
  const restoredParentFilter = ref<Record<string, unknown>>({})
  let isSyncingChipColumnFilters = false
  let isHydratingChipFilters = false

  const {
    items,
    search,
    page,
    itemsPerPage,
    totalItems,
    isLoading,
    sortBy,
    columnFilters,
    activeFilter,
    entityTemplates,
    entity,
    entityPermission,
    formConfigMenuItems,
    selectedFormConfigLabel,
    isLoadingFormConfigs,
    isSavingTableView,
    parentFilter,
    isInitialized,
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
  } = useSaplingTable(entityHandle, undefined, true, true, () => ({
    beforeInitialLoad: prepareInitialPartnerFilter,
  }))

  const tableKey = computed(() => `${entityHandle.value}-table`)
  const filterDrawerKey = computed(() => `${entityHandle.value}-filter`)
  const partnerTemplates = computed(() =>
    entityTemplates.value.filter((template) => template.options?.includes('isPartner')),
  )
  const {
    chipFilters,
    selectedChipFilters,
    selectedChipFilterCount,
    loadChipFilters,
    clearChipFilters,
    onSelectedChipFiltersUpdate: updateSelectedChipFilters,
  } = useSaplingChipFilters({
    entityHandle,
    entityTemplates,
  })
  //#endregion

  //#region Lifecycle
  watch(entityHandle, () => {
    selectedPeopleHandles.value = []
    restoredParentFilter.value = {}
    clearChipFilters()
    applyPartnerFilter()
  })

  watch(
    entityTemplates,
    async () => {
      if (!isInitialized.value) {
        return
      }

      await hydrateChipFiltersFromTableState()
    },
    { deep: true },
  )

  watch(
    isInitialized,
    async (nextIsInitialized) => {
      if (!nextIsInitialized) {
        return
      }

      await hydrateChipFiltersFromTableState()
    },
    { immediate: true },
  )

  watch(
    selectedChipFilters,
    () => {
      if (isHydratingChipFilters) {
        return
      }

      syncColumnFiltersFromSelectedChipFilters()
      applyPartnerFilter()
    },
    { deep: true },
  )

  watch(
    columnFilters,
    () => {
      if (isSyncingChipColumnFilters) {
        return
      }

      syncSelectedChipFiltersFromColumnFilters()
    },
    { deep: true },
  )
  //#endregion

  //#region Methods
  /**
   * Updates the partner selection from the work filter drawer.
   */
  function onSelectedPeoplesUpdate(values: string[]) {
    selectedPeopleHandles.value = normalizePartnerHandles(values)
    applyPartnerFilter()
  }

  /**
   * Updates the selected chip reference filters from the shared work filter drawer.
   */
  function onSelectedChipFiltersUpdate(values: SaplingChipFilterSelection) {
    updateSelectedChipFilters(values)
  }

  async function hydrateChipFiltersFromTableState() {
    isHydratingChipFilters = true

    try {
      await loadChipFilters()
      syncSelectedChipFiltersFromColumnFilters()
      await nextTick()
    } finally {
      isHydratingChipFilters = false
    }
  }

  /**
   * Prepares the default partner filter before the first table query is sent.
   */
  async function prepareInitialPartnerFilter(context?: SaplingTableInitialLoadContext) {
    await currentPersonStore.fetchCurrentPerson()
    const isDefaultWorklistReset = context?.isDefaultWorklistReset === true
    restoredParentFilter.value = isDefaultWorklistReset ? {} : cloneFilter(parentFilter.value)
    const routeFilter = readSaplingTableRouteState(route.query, true).filter
    const hasExplicitRouteFilter = !isDefaultWorklistReset && routeFilter !== null
    selectedPeopleHandles.value =
      hasExplicitRouteFilter ||
      (!isDefaultWorklistReset && hasOpenHandleQuery()) ||
      currentPersonStore.person?.handle == null
        ? []
        : [currentPersonStore.person.handle]

    if (!isDefaultWorklistReset) {
      hydratePartnerSelectionFromFilter(
        isFilterRecord(routeFilter) ? routeFilter : restoredParentFilter.value,
      )
      restoredParentFilter.value = removePartnerSelectionFilter(
        restoredParentFilter.value,
        partnerTemplates.value,
      )
    }
    applyPartnerFilter()
  }

  /**
   * Rebuilds the table parent filter so partner fields may match.
   * Chip filters are kept in table columnFilters so the header badges, URL and
   * partner drawer all share one state.
   */
  function applyPartnerFilter() {
    parentFilter.value = combinePartnerFilters(
      restoredParentFilter.value,
      buildPartnerFilter(selectedPeopleHandles.value, partnerTemplates.value),
    )
  }

  function hydratePartnerSelectionFromFilter(filter: Record<string, unknown>) {
    const restoredPeopleHandles = extractPartnerHandlesFromFilter(filter, partnerTemplates.value)

    if (restoredPeopleHandles.length > 0) {
      selectedPeopleHandles.value = restoredPeopleHandles
    }
  }

  function hasOpenHandleQuery(): boolean {
    const value = Array.isArray(route.query.open) ? route.query.open[0] : route.query.open
    return typeof value === 'string' && value.trim().length > 0
  }

  function syncSelectedChipFiltersFromColumnFilters() {
    if (chipFilters.value.length === 0) {
      return
    }

    const nextSelection = Object.fromEntries(
      chipFilters.value.map((filter) => [
        filter.key,
        getChipSelectionFromColumnFilter(filter, columnFilters.value[filter.key]),
      ]),
    )

    if (areSelectionsEqual(selectedChipFilters.value, nextSelection)) {
      return
    }

    updateSelectedChipFilters(nextSelection)
  }

  function syncColumnFiltersFromSelectedChipFilters() {
    if (chipFilters.value.length === 0) {
      return
    }

    const nextColumnFilters = { ...columnFilters.value }

    chipFilters.value.forEach((filter) => {
      const nextColumnFilter = buildChipColumnFilterFromSelection(
        filter,
        selectedChipFilters.value[filter.key] ?? [],
      )

      if (nextColumnFilter) {
        nextColumnFilters[filter.key] = nextColumnFilter
        return
      }

      delete nextColumnFilters[filter.key]
    })

    if (arePartnerColumnFiltersEqual(columnFilters.value, nextColumnFilters)) {
      return
    }

    isSyncingChipColumnFilters = true
    columnFilters.value = nextColumnFilters
    page.value = 1
    isSyncingChipColumnFilters = false
  }
  //#endregion

  //#region Return
  return {
    items,
    search,
    page,
    itemsPerPage,
    totalItems,
    isLoading,
    sortBy,
    columnFilters,
    activeFilter,
    entityTemplates,
    entity,
    entityPermission,
    formConfigMenuItems,
    selectedFormConfigLabel,
    isLoadingFormConfigs,
    isSavingTableView,
    isInitialized,
    parentFilter,
    selectedPeopleHandles,
    tableKey,
    filterDrawerKey,
    chipFilters,
    selectedChipFilters,
    selectedChipFilterCount,
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
    onSelectedPeoplesUpdate,
    onSelectedChipFiltersUpdate,
  }
  //#endregion
}
