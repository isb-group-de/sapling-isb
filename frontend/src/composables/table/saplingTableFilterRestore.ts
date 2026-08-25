import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import { isFilterableTableColumn, isManyToOneTemplate } from '@/utils/saplingTableUtil'
import { getColumnTemplate } from './saplingTableColumnFilterState'
import {
  createRelationFilterItem,
  normalizeRestoredColumnFilter,
  restoreColumnFilterFromClause,
} from './saplingTableFilterClauseRestore'

export function extractColumnFiltersFromFilterQuery(
  entityTemplates: EntityTemplate[],
  filterQuery: unknown,
) {
  if (!filterQuery || typeof filterQuery !== 'object') {
    return {}
  }

  const restoredFilters = new Map<string, Partial<ColumnFilterItem>>()
  collectRestoredColumnFilters(filterQuery as FilterQuery, entityTemplates, restoredFilters)

  return Object.fromEntries(
    Array.from(restoredFilters.entries()).flatMap(([key, filter]) => {
      const template = getColumnTemplate(entityTemplates, key)
      if (!template || !isFilterableTableColumn(template)) {
        return []
      }

      const normalizedFilter = normalizeRestoredColumnFilter(template, filter)
      return normalizedFilter ? [[key, normalizedFilter]] : []
    }),
  )
}

export function removeRestoredColumnFiltersFromFilterQuery(
  entityTemplates: EntityTemplate[],
  filterQuery: unknown,
): FilterQuery | null {
  if (!filterQuery || typeof filterQuery !== 'object') {
    return null
  }

  return pruneRestoredFilterNode(filterQuery as FilterQuery, entityTemplates)
}

export function removeMatchingFilterFromFilterQuery(
  filterQuery: unknown,
  filterToRemove: FilterQuery,
): FilterQuery | null {
  if (!filterQuery || typeof filterQuery !== 'object') {
    return null
  }

  if (Object.keys(filterToRemove).length === 0) {
    return filterQuery as FilterQuery
  }

  const remainingClauses = [...getConjunctiveClauses(filterQuery as FilterQuery)]
  const clausesToRemove = getConjunctiveClauses(filterToRemove)
  let removedClauseCount = 0

  clausesToRemove.forEach((clauseToRemove) => {
    const matchingIndex = remainingClauses.findIndex((clause) =>
      areFilterValuesEqual(clause, clauseToRemove),
    )
    if (matchingIndex < 0) {
      return
    }

    remainingClauses.splice(matchingIndex, 1)
    removedClauseCount += 1
  })

  if (removedClauseCount !== clausesToRemove.length) {
    return filterQuery as FilterQuery
  }

  if (remainingClauses.length === 0) {
    return null
  }
  if (remainingClauses.length === 1) {
    return remainingClauses[0]
  }
  return { $and: remainingClauses }
}

export function removeUnavailableFieldFilters(
  filterQuery: unknown,
  entityTemplates: EntityTemplate[],
): { filter: FilterQuery | null; removed: boolean } {
  if (!filterQuery || typeof filterQuery !== 'object' || Array.isArray(filterQuery)) {
    return { filter: null, removed: false }
  }
  const availableFields = new Set(
    entityTemplates
      .filter((template) => template.fieldAccess?.allowRead !== false)
      .map((template) => template.name),
  )
  let removed = false

  function prune(node: FilterQuery): FilterQuery | null {
    const result: FilterQuery = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === '$and' || key === '$or') {
        const clauses = Array.isArray(value)
          ? value
              .map((entry) =>
                entry && typeof entry === 'object' && !Array.isArray(entry)
                  ? prune(entry as FilterQuery)
                  : null,
              )
              .filter((entry): entry is FilterQuery => entry !== null)
          : []
        if (clauses.length > 0) result[key] = clauses
        else if (Array.isArray(value) && value.length > 0) removed = true
        continue
      }
      if (key.startsWith('$')) {
        result[key] = value
        continue
      }
      if (!availableFields.has(key)) {
        removed = true
        continue
      }
      result[key] = value
    }
    return Object.keys(result).length > 0 ? result : null
  }

  return { filter: prune(filterQuery as FilterQuery), removed }
}

function getConjunctiveClauses(filterQuery: FilterQuery): FilterQuery[] {
  if (Object.keys(filterQuery).length === 1 && Array.isArray(filterQuery.$and)) {
    return filterQuery.$and.filter(
      (clause): clause is FilterQuery => clause !== null && typeof clause === 'object',
    )
  }

  return [filterQuery]
}

function areFilterValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areFilterValuesEqual(value, right[index]))
    )
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord).sort()
  const rightKeys = Object.keys(rightRecord).sort()

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && areFilterValuesEqual(leftRecord[key], rightRecord[key]),
    )
  )
}

function collectRestoredColumnFilters(
  filterNode: FilterQuery,
  entityTemplates: EntityTemplate[],
  restoredFilters: Map<string, Partial<ColumnFilterItem>>,
) {
  if (tryCollectAndClauses(filterNode, entityTemplates, restoredFilters)) {
    return
  }

  if (tryCollectRelationOrClause(filterNode, entityTemplates, restoredFilters)) {
    return
  }

  for (const [key, value] of Object.entries(filterNode)) {
    if (key.startsWith('$')) {
      continue
    }

    const template = getColumnTemplate(entityTemplates, key)
    if (!template || !isFilterableTableColumn(template)) {
      continue
    }

    const restoredFilter = restoreColumnFilterFromClause(template, value)
    if (!restoredFilter) {
      continue
    }

    mergeRestoredFilter(restoredFilters, key, restoredFilter)
  }
}

function pruneRestoredFilterNode(
  filterNode: FilterQuery,
  entityTemplates: EntityTemplate[],
): FilterQuery | null {
  if (isRestorableRelationOrClause(filterNode, entityTemplates)) {
    return null
  }

  const andClauses = Array.isArray(filterNode.$and)
    ? filterNode.$and
        .map((clause) =>
          clause && typeof clause === 'object'
            ? pruneRestoredFilterNode(clause as FilterQuery, entityTemplates)
            : null,
        )
        .filter((clause): clause is FilterQuery => clause !== null)
    : []

  const remainingFilter: FilterQuery = {}

  Object.entries(filterNode).forEach(([key, value]) => {
    if (key === '$and') {
      return
    }

    if (key.startsWith('$')) {
      remainingFilter[key] = value
      return
    }

    const template = getColumnTemplate(entityTemplates, key)
    if (
      template &&
      isFilterableTableColumn(template) &&
      restoreColumnFilterFromClause(template, value)
    ) {
      return
    }

    remainingFilter[key] = value
  })

  if (andClauses.length === 0) {
    return Object.keys(remainingFilter).length > 0 ? remainingFilter : null
  }

  if (Object.keys(remainingFilter).length === 0) {
    if (andClauses.length === 1) {
      return andClauses[0]
    }

    return { $and: andClauses }
  }

  return {
    ...remainingFilter,
    $and: andClauses,
  }
}

function tryCollectAndClauses(
  filterNode: FilterQuery,
  entityTemplates: EntityTemplate[],
  restoredFilters: Map<string, Partial<ColumnFilterItem>>,
) {
  if (!Array.isArray(filterNode.$and)) {
    return false
  }

  filterNode.$and.forEach((clause) => {
    if (clause && typeof clause === 'object') {
      collectRestoredColumnFilters(clause as FilterQuery, entityTemplates, restoredFilters)
    }
  })

  return true
}

function tryCollectRelationOrClause(
  filterNode: FilterQuery,
  entityTemplates: EntityTemplate[],
  restoredFilters: Map<string, Partial<ColumnFilterItem>>,
) {
  if (!Array.isArray(filterNode.$or) || filterNode.$or.length === 0) {
    return false
  }

  let columnKey: string | null = null
  const relationItems: SaplingGenericItem[] = []

  for (const clause of filterNode.$or) {
    if (!clause || typeof clause !== 'object') {
      return false
    }

    const entries = Object.entries(clause as FilterQuery).filter(([key]) => !key.startsWith('$'))
    if (entries.length !== 1) {
      return false
    }

    const [key, value] = entries[0]
    const template = getColumnTemplate(entityTemplates, key)
    if (!template || !isFilterableTableColumn(template) || !isManyToOneTemplate(template)) {
      return false
    }

    const relationItem = createRelationFilterItem(value)
    if (!relationItem) {
      return false
    }

    columnKey ??= key
    if (columnKey !== key) {
      return false
    }

    relationItems.push(relationItem)
  }

  if (!columnKey || relationItems.length === 0) {
    return false
  }

  mergeRestoredFilter(restoredFilters, columnKey, {
    operator: 'eq',
    relationItems,
  })

  return true
}

function isRestorableRelationOrClause(filterNode: FilterQuery, entityTemplates: EntityTemplate[]) {
  return tryCollectRelationOrClause(filterNode, entityTemplates, new Map())
}

function mergeRestoredFilter(
  restoredFilters: Map<string, Partial<ColumnFilterItem>>,
  key: string,
  nextFilter: Partial<ColumnFilterItem>,
) {
  const existingFilter = restoredFilters.get(key) ?? {}

  restoredFilters.set(key, {
    ...existingFilter,
    ...nextFilter,
    relationItems: mergeRelationItems(existingFilter.relationItems, nextFilter.relationItems),
  })
}

function mergeRelationItems(
  existingItems?: SaplingGenericItem[],
  nextItems?: SaplingGenericItem[],
): SaplingGenericItem[] | undefined {
  const mergedItems = [...(existingItems ?? []), ...(nextItems ?? [])]
  if (mergedItems.length === 0) {
    return undefined
  }

  const seenItems = new Set<string>()
  return mergedItems.filter((item) => {
    const itemKey = JSON.stringify(item)
    if (seenItems.has(itemKey)) {
      return false
    }

    seenItems.add(itemKey)
    return true
  })
}
