import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import { useSaplingChipFilters } from '@/composables/filter/useSaplingChipFilters'
import type {
  SaplingChipFilterGroup,
  SaplingChipFilterSelection,
  SaplingFilterHandle,
} from '@/components/filter/saplingWorkFilter.types'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'

type PartnerHandle = number
type PartnerFilterClause = Record<string, { $in: PartnerHandle[] }>

const EMPTY_CHIP_FILTER_SENTINEL = '__sapling_empty_chip_filter__'

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
    parentFilter,
    isInitialized,
    loadData,
    onSearchUpdate,
    onPageUpdate,
    onItemsPerPageUpdate,
    onColumnFiltersUpdate,
    onSortByUpdate,
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
      applyPartnerFilter()
      await nextTick()
    } finally {
      isHydratingChipFilters = false
    }
  }

  /**
   * Prepares the default partner filter before the first table query is sent.
   */
  async function prepareInitialPartnerFilter() {
    await currentPersonStore.fetchCurrentPerson()
    restoredParentFilter.value = cloneFilter(parentFilter.value)
    selectedPeopleHandles.value =
      hasOpenHandleQuery() || currentPersonStore.person?.handle == null
        ? []
        : [currentPersonStore.person.handle]

    hydratePartnerSelectionFromRestoredFilter()
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

  function hydratePartnerSelectionFromRestoredFilter() {
    const restoredPeopleHandles = extractPartnerHandlesFromFilter(
      restoredParentFilter.value,
      partnerTemplates.value,
    )

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
    onSelectedPeoplesUpdate,
    onSelectedChipFiltersUpdate,
  }
  //#endregion
}

/**
 * Normalizes emitted drawer values into numeric person handles.
 */
function normalizePartnerHandles(values: string[]): PartnerHandle[] {
  return values.map((value) => Number.parseInt(value, 10)).filter((value) => !Number.isNaN(value))
}

/**
 * Builds an OR-based filter across all template fields marked with the partner option.
 */
function buildPartnerFilter(
  selectedPeopleHandles: PartnerHandle[],
  templates: EntityTemplate[],
): Record<string, unknown> {
  if (selectedPeopleHandles.length === 0 || templates.length === 0) {
    return {}
  }

  const orFilters = templates
    .map((template) => {
      const propertyName = template.name?.trim()
      return propertyName ? { [propertyName]: { $in: selectedPeopleHandles } } : null
    })
    .filter((filter): filter is PartnerFilterClause => filter !== null)

  return orFilters.length > 0 ? { $or: orFilters } : {}
}

export function combinePartnerFilters(
  restoredFilter: Record<string, unknown>,
  partnerFilter: Record<string, unknown>,
): Record<string, unknown> {
  const hasRestoredFilter = Object.keys(restoredFilter).length > 0
  const hasPartnerFilter = Object.keys(partnerFilter).length > 0

  if (hasRestoredFilter && hasPartnerFilter && areFiltersEqual(restoredFilter, partnerFilter)) {
    return restoredFilter
  }

  if (hasRestoredFilter && hasPartnerFilter) {
    return { $and: [restoredFilter, partnerFilter] }
  }

  return hasRestoredFilter ? restoredFilter : partnerFilter
}

function cloneFilter(filter: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(filter)) as Record<string, unknown>
}

export function buildChipColumnFilterFromSelection(
  filter: SaplingChipFilterGroup,
  selectedHandles: SaplingFilterHandle[],
): ColumnFilterItem | null {
  const allHandles = filter.options.map((option) => option.handle)
  const validHandles = selectedHandles.filter((handle) => allHandles.includes(handle))

  if (isFullChipFilterSelection(validHandles, allHandles)) {
    return null
  }

  const handles = validHandles.length > 0 ? validHandles : [EMPTY_CHIP_FILTER_SENTINEL]

  return {
    operator: 'eq',
    value: '',
    relationItems: handles.map((handle) => ({
      [filter.identifierKey]: handle,
    })),
  }
}

export function getChipSelectionFromColumnFilter(
  filter: SaplingChipFilterGroup,
  columnFilter?: ColumnFilterItem,
): SaplingFilterHandle[] {
  const allHandles = filter.options.map((option) => option.handle)

  if (!columnFilter?.relationItems?.length) {
    return allHandles
  }

  const relationHandles = columnFilter.relationItems
    .map((item) => item?.[filter.identifierKey])
    .filter((handle): handle is SaplingFilterHandle => isSaplingFilterHandle(handle))

  if (columnFilter.operator === 'nin') {
    return allHandles.filter((handle) => !relationHandles.includes(handle))
  }

  return relationHandles.filter((handle) => allHandles.includes(handle))
}

export function extractPartnerHandlesFromFilter(
  filter: Record<string, unknown>,
  templates: EntityTemplate[],
): PartnerHandle[] {
  const partnerFieldNames = templates
    .map((template) => template.name?.trim())
    .filter((name): name is string => Boolean(name))

  if (partnerFieldNames.length === 0) {
    return []
  }

  const handles = collectPartnerHandles(filter, new Set(partnerFieldNames))
  return Array.from(new Set(handles)).sort((left, right) => left - right)
}

function collectPartnerHandles(filter: unknown, partnerFieldNames: Set<string>): PartnerHandle[] {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return []
  }

  const filterNode = filter as Record<string, unknown>
  const handles: PartnerHandle[] = []

  if (Array.isArray(filterNode.$and)) {
    filterNode.$and.forEach((clause) => {
      handles.push(...collectPartnerHandles(clause, partnerFieldNames))
    })
  }

  if (Array.isArray(filterNode.$or)) {
    const orHandles = collectPartnerHandlesFromOrClause(filterNode.$or, partnerFieldNames)
    if (orHandles.length > 0) {
      handles.push(...orHandles)
    }
  }

  Object.entries(filterNode).forEach(([key, value]) => {
    if (key.startsWith('$') || !partnerFieldNames.has(key)) {
      return
    }

    handles.push(...extractNumericHandles(value))
  })

  return handles
}

function collectPartnerHandlesFromOrClause(
  clauses: unknown[],
  partnerFieldNames: Set<string>,
): PartnerHandle[] {
  const handles: PartnerHandle[] = []

  for (const clause of clauses) {
    if (!clause || typeof clause !== 'object' || Array.isArray(clause)) {
      return []
    }

    const entries = Object.entries(clause as Record<string, unknown>).filter(
      ([key]) => !key.startsWith('$'),
    )

    if (entries.length !== 1 || !partnerFieldNames.has(entries[0][0])) {
      return []
    }

    handles.push(...extractNumericHandles(entries[0][1]))
  }

  return handles
}

function extractNumericHandles(value: unknown): PartnerHandle[] {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value]
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10)
    return Number.isNaN(parsedValue) ? [] : [parsedValue]
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  const valueNode = value as Record<string, unknown>
  const directHandle = valueNode.handle
  if (typeof directHandle === 'number' || typeof directHandle === 'string') {
    return extractNumericHandles(directHandle)
  }

  const inValues = Array.isArray(valueNode.$in)
    ? valueNode.$in
    : isNestedInHandleFilter(valueNode)
      ? (valueNode.handle as Record<string, unknown>).$in
      : []

  return (inValues as unknown[]).flatMap(extractNumericHandles)
}

function isNestedInHandleFilter(value: Record<string, unknown>) {
  return (
    value.handle != null &&
    typeof value.handle === 'object' &&
    !Array.isArray(value.handle) &&
    Array.isArray((value.handle as Record<string, unknown>).$in)
  )
}

function isFullChipFilterSelection(
  selectedHandles: SaplingFilterHandle[],
  allHandles: SaplingFilterHandle[],
): boolean {
  if (selectedHandles.length !== allHandles.length) {
    return false
  }

  return allHandles.every((handle) => selectedHandles.includes(handle))
}

function isSaplingFilterHandle(value: unknown): value is SaplingFilterHandle {
  return typeof value === 'string' || typeof value === 'number'
}

function areSelectionsEqual(
  left: SaplingChipFilterSelection,
  right: SaplingChipFilterSelection,
): boolean {
  return (
    JSON.stringify(normalizeSelectionForComparison(left)) ===
    JSON.stringify(normalizeSelectionForComparison(right))
  )
}

function normalizeSelectionForComparison(selection: SaplingChipFilterSelection) {
  return Object.fromEntries(
    Object.entries(selection).map(([key, values]) => [
      key,
      values
        .filter((value): value is SaplingFilterHandle => isSaplingFilterHandle(value))
        .sort(compareFilterHandles),
    ]),
  )
}

export function arePartnerColumnFiltersEqual(
  left: Record<string, ColumnFilterItem>,
  right: Record<string, ColumnFilterItem>,
): boolean {
  return (
    JSON.stringify(normalizeColumnFiltersForComparison(left)) ===
    JSON.stringify(normalizeColumnFiltersForComparison(right))
  )
}

function areFiltersEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function normalizeColumnFiltersForComparison(filters: Record<string, ColumnFilterItem>) {
  return Object.fromEntries(
    Object.entries(filters)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, filter]) => [
        key,
        {
          ...filter,
          relationItems: filter.relationItems
            ?.map((item) => ({ ...item }))
            .sort((leftItem, rightItem) =>
              JSON.stringify(leftItem).localeCompare(JSON.stringify(rightItem)),
            ),
        },
      ]),
  )
}

function compareFilterHandles(left: SaplingFilterHandle, right: SaplingFilterHandle): number {
  return String(left).localeCompare(String(right))
}
