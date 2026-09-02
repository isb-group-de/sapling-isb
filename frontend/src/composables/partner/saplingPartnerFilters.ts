import type {
  SaplingChipFilterGroup,
  SaplingChipFilterSelection,
  SaplingFilterHandle,
} from '@/components/filter/saplingWorkFilter.types'
import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'

type PartnerHandle = number
type PartnerFilterClause = Record<string, { $in: PartnerHandle[] }>

const EMPTY_CHIP_FILTER_SENTINEL = '__sapling_empty_chip_filter__'

export function normalizePartnerHandles(values: string[]): PartnerHandle[] {
  return values.map((value) => Number.parseInt(value, 10)).filter((value) => !Number.isNaN(value))
}

export function buildPartnerFilter(
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

export function cloneFilter(filter: Record<string, unknown>): Record<string, unknown> {
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
    relationItems: handles.map((handle) => ({ handle })),
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
    .map((item) => item?.handle)
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

export function removePartnerSelectionFilter(
  filter: Record<string, unknown>,
  templates: EntityTemplate[],
): Record<string, unknown> {
  const partnerFieldNames = new Set(
    templates
      .map((template) => template.name?.trim())
      .filter((name): name is string => Boolean(name)),
  )

  if (partnerFieldNames.size === 0) {
    return cloneFilter(filter)
  }

  return stripPartnerSelectionNode(filter, partnerFieldNames)
}

function stripPartnerSelectionNode(
  filter: Record<string, unknown>,
  partnerFieldNames: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  Object.entries(filter).forEach(([key, value]) => {
    if (partnerFieldNames.has(key)) return

    if (key === '$and' && Array.isArray(value)) {
      const clauses = value
        .map((clause) =>
          isFilterRecord(clause) ? stripPartnerSelectionNode(clause, partnerFieldNames) : clause,
        )
        .filter((clause) => !isEmptyFilterRecord(clause))
      if (clauses.length > 0) result[key] = clauses
      return
    }

    if (
      key === '$or' &&
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (clause) =>
          isFilterRecord(clause) && isPartnerSelectionOnlyFilter(clause, partnerFieldNames),
      )
    ) {
      return
    }

    result[key] = cloneFilterValue(value)
  })

  return result
}

function isPartnerSelectionOnlyFilter(
  filter: Record<string, unknown>,
  partnerFieldNames: Set<string>,
): boolean {
  const entries = Object.entries(filter)
  if (entries.length === 0) return false

  return entries.every(([key, value]) => {
    if (partnerFieldNames.has(key)) return true
    if ((key === '$and' || key === '$or') && Array.isArray(value) && value.length > 0) {
      return value.every(
        (clause) =>
          isFilterRecord(clause) && isPartnerSelectionOnlyFilter(clause, partnerFieldNames),
      )
    }
    return false
  })
}

function isFilterRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isEmptyFilterRecord(value: unknown): boolean {
  return isFilterRecord(value) && Object.keys(value).length === 0
}

function cloneFilterValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function collectPartnerHandles(filter: unknown, partnerFieldNames: Set<string>): PartnerHandle[] {
  if (!isFilterRecord(filter)) return []

  const handles: PartnerHandle[] = []
  if (Array.isArray(filter.$and)) {
    filter.$and.forEach((clause) =>
      handles.push(...collectPartnerHandles(clause, partnerFieldNames)),
    )
  }
  if (Array.isArray(filter.$or)) {
    handles.push(...collectPartnerHandlesFromOrClause(filter.$or, partnerFieldNames))
  }
  Object.entries(filter).forEach(([key, value]) => {
    if (!key.startsWith('$') && partnerFieldNames.has(key)) {
      handles.push(...extractNumericHandles(value))
    }
  })
  return handles
}

function collectPartnerHandlesFromOrClause(
  clauses: unknown[],
  partnerFieldNames: Set<string>,
): PartnerHandle[] {
  const handles: PartnerHandle[] = []
  for (const clause of clauses) {
    if (!isFilterRecord(clause)) return []
    const entries = Object.entries(clause).filter(([key]) => !key.startsWith('$'))
    if (entries.length !== 1 || !partnerFieldNames.has(entries[0][0])) return []
    handles.push(...extractNumericHandles(entries[0][1]))
  }
  return handles
}

function extractNumericHandles(value: unknown): PartnerHandle[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [value]
  if (typeof value === 'string') {
    const parsedValue = Number.parseInt(value, 10)
    return Number.isNaN(parsedValue) ? [] : [parsedValue]
  }
  if (!isFilterRecord(value)) return []

  if (typeof value.handle === 'number' || typeof value.handle === 'string') {
    return extractNumericHandles(value.handle)
  }
  const inValues = Array.isArray(value.$in)
    ? value.$in
    : isNestedInHandleFilter(value)
      ? (value.handle as Record<string, unknown>).$in
      : []
  return (inValues as unknown[]).flatMap(extractNumericHandles)
}

function isNestedInHandleFilter(value: Record<string, unknown>) {
  return isFilterRecord(value.handle) && Array.isArray(value.handle.$in)
}

function isFullChipFilterSelection(
  selectedHandles: SaplingFilterHandle[],
  allHandles: SaplingFilterHandle[],
): boolean {
  return (
    selectedHandles.length === allHandles.length &&
    allHandles.every((handle) => selectedHandles.includes(handle))
  )
}

function isSaplingFilterHandle(value: unknown): value is SaplingFilterHandle {
  return typeof value === 'string' || typeof value === 'number'
}

export function areSelectionsEqual(
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
