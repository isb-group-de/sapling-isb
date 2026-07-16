import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import type { FilterQuery } from '@/services/api.generic.service'
import { isManyToOneTemplate } from '@/utils/saplingTableUtil'
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
      if (!template) {
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
    if (!template) {
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
    if (template && restoreColumnFilterFromClause(template, value)) {
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
    if (!template || !isManyToOneTemplate(template)) {
      return false
    }

    const relationItem = createRelationFilterItem(template, value)
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
