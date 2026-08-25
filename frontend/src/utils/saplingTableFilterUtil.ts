import type { SaplingGenericItem } from '@/entity/entity'
import type {
  ColumnFilterItem,
  ColumnFilterOperator,
  EntityTemplate,
  SortItem,
} from '@/entity/structure'
import type { FilterQuery } from '@/services/api.generic.service'
import {
  getAllowedColumnFilterOperators,
  getDefaultColumnFilterOperatorForTemplate,
  isBooleanTemplate,
  isDateTemplate,
  isFilterableTableColumn,
  isManyToOneTemplate,
  isNumericTemplate,
  isRangeTemplate,
  isTextSearchableTemplate,
} from './saplingTableTemplateUtil'

export function buildTableFilter({
  search,
  columnFilters = {},
  entityTemplates,
  referenceSearchTemplates = {},
  parentFilter,
}: {
  search?: string
  columnFilters?: Record<string, string | ColumnFilterItem>
  entityTemplates: EntityTemplate[]
  referenceSearchTemplates?: Record<string, EntityTemplate[]>
  parentFilter?: Record<string, unknown>
}): FilterQuery {
  const clauses: FilterQuery[] = []
  const filterableTemplates = entityTemplates.filter(isFilterableTableColumn)
  const searchableTemplates = filterableTemplates.filter(isTextSearchableTemplate)
  const searchableReferenceTemplates = Object.entries(referenceSearchTemplates).flatMap(
    ([relationName, templates]) =>
      templates
        .filter(isFilterableTableColumn)
        .filter(isTextSearchableTemplate)
        .filter((template) => template.options?.includes('isValue'))
        .map((template) => ({ relationName, template })),
  )
  const searchTerms = search?.trim().split(/\s+/).filter(Boolean) ?? []

  if (
    searchTerms.length > 0 &&
    (searchableTemplates.length > 0 || searchableReferenceTemplates.length > 0)
  ) {
    clauses.push(
      ...searchTerms.map((searchTerm) => ({
        $or: [
          ...searchableTemplates.map((template) => ({
            [template.name]: { $ilike: `%${searchTerm}%` },
          })),
          ...searchableReferenceTemplates.map(({ relationName, template }) => ({
            [relationName]: {
              [template.name]: { $ilike: `%${searchTerm}%` },
            },
          })),
        ],
      })),
    )
  }

  Object.entries(columnFilters).forEach(([key, value]) => {
    const matchingTemplate = filterableTemplates.find(
      (template) => (template.key ?? template.name) === key,
    )
    if (!matchingTemplate) return

    const normalizedValue = normalizeColumnFilter(matchingTemplate, value)
    if (isEmptyColumnFilter(normalizedValue)) return
    clauses.push(buildColumnFilterClause(matchingTemplate, normalizedValue))
  })

  if (parentFilter && Object.keys(parentFilter).length > 0) {
    clauses.push(parentFilter)
  }

  if (clauses.length === 0) return {}
  if (clauses.length === 1) return clauses[0]
  return { $and: clauses }
}

export function buildTableOrderBy(sortBy: SortItem[] = []): Record<string, string> {
  const orderBy: Record<string, string> = {}

  sortBy.forEach((sort) => {
    if (!sort.key || ['__select', '__actions'].includes(sort.key)) return
    orderBy[sort.key] = sort.order === 'desc' ? 'DESC' : 'ASC'
  })

  return orderBy
}

function normalizeColumnFilter(
  template: Partial<EntityTemplate> | undefined,
  value: string | ColumnFilterItem,
): ColumnFilterItem {
  if (typeof value === 'string') {
    return {
      operator: getDefaultColumnFilterOperatorForTemplate(template),
      value: value.trim(),
    }
  }

  return {
    operator: getNormalizedColumnFilterOperator(template, value.operator),
    value: value.value.trim(),
    rangeStart: value.rangeStart?.trim(),
    rangeEnd: value.rangeEnd?.trim(),
    rangeStartOperator: value.rangeStartOperator,
    rangeEndOperator: value.rangeEndOperator,
    relationItems: value.relationItems?.map((item) => ({ ...item })),
  }
}

function buildColumnFilterClause(template: EntityTemplate, filter: ColumnFilterItem): FilterQuery {
  if (filter.operator === 'isSet') {
    return { [template.name]: { $ne: null } }
  }

  if (filter.operator === 'isEmpty') {
    return { [template.name]: null }
  }

  if (isManyToOneTemplate(template) && (filter.relationItems?.length ?? 0) > 0) {
    return buildManyToOneColumnFilterClause(template, filter.relationItems ?? [], filter.operator)
  }

  if (isRangeTemplate(template) && filter.operator === 'between') {
    return buildRangeColumnFilterClause(
      template,
      filter.rangeStart,
      filter.rangeEnd,
      filter.rangeStartOperator,
      filter.rangeEndOperator,
    )
  }

  const operator = getNormalizedColumnFilterOperator(template, filter.operator)
  if (isDateTemplate(template)) {
    return buildDateColumnFilterClause(template.name, operator, filter.value)
  }

  const normalizedValue = normalizeFilterValue(template, filter.value)
  if (operator === 'like') {
    return { [template.name]: { $ilike: `%${String(normalizedValue)}%` } }
  }
  if (operator === 'startsWith') {
    return { [template.name]: { $ilike: `${String(normalizedValue)}%` } }
  }
  if (operator === 'endsWith') {
    return { [template.name]: { $ilike: `%${String(normalizedValue)}` } }
  }

  switch (operator) {
    case 'eq':
      return { [template.name]: { $eq: normalizedValue } }
    case 'gt':
      return { [template.name]: { $gt: normalizedValue } }
    case 'gte':
      return { [template.name]: { $gte: normalizedValue } }
    case 'lt':
      return { [template.name]: { $lt: normalizedValue } }
    case 'lte':
      return { [template.name]: { $lte: normalizedValue } }
    default:
      return { [template.name]: { $eq: normalizedValue } }
  }
}

function normalizeFilterValue(
  template: EntityTemplate,
  rawValue: string,
): string | number | boolean {
  if (isNumericTemplate(template)) {
    const numericValue = Number(rawValue)
    return Number.isNaN(numericValue) ? rawValue : numericValue
  }

  if (isBooleanTemplate(template)) {
    const normalizedBoolean = rawValue.toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(normalizedBoolean)) return true
    if (['false', '0', 'no', 'n'].includes(normalizedBoolean)) return false
  }

  return rawValue
}

function getNormalizedColumnFilterOperator(
  template: Partial<EntityTemplate> | undefined,
  operator: ColumnFilterOperator,
): ColumnFilterOperator {
  const allowedOperators = getAllowedColumnFilterOperators(template)
  return allowedOperators.includes(operator)
    ? operator
    : getDefaultColumnFilterOperatorForTemplate(template)
}

function isEmptyColumnFilter(filter: ColumnFilterItem): boolean {
  if (filter.operator === 'isSet' || filter.operator === 'isEmpty') return false
  return (
    filter.value.length === 0 &&
    (filter.rangeStart?.length ?? 0) === 0 &&
    (filter.rangeEnd?.length ?? 0) === 0 &&
    (filter.relationItems?.length ?? 0) === 0
  )
}

function buildDateColumnFilterClause(
  key: string,
  operator: ColumnFilterOperator,
  rawValue: string,
): FilterQuery {
  const normalizedDate = normalizeDateFilterValue(rawValue)
  const operatorMap: Record<'eq' | 'gt' | 'gte' | 'lt' | 'lte', string> = {
    eq: '$eq',
    gt: '$gt',
    gte: '$gte',
    lt: '$lt',
    lte: '$lte',
  }
  const normalizedOperator = ['gt', 'gte', 'lt', 'lte'].includes(operator) ? operator : 'eq'

  if (!normalizedDate) {
    return {
      [key]: {
        [operatorMap[normalizedOperator as 'eq' | 'gt' | 'gte' | 'lt' | 'lte']]: rawValue,
      },
    }
  }

  if (!normalizedDate.isDateOnly) {
    return {
      [key]: {
        [operatorMap[normalizedOperator as 'eq' | 'gt' | 'gte' | 'lt' | 'lte']]:
          normalizedDate.start,
      },
    }
  }

  switch (operator) {
    case 'gt':
      return { [key]: { $gte: normalizedDate.endExclusive } }
    case 'gte':
      return { [key]: { $gte: normalizedDate.start } }
    case 'lt':
      return { [key]: { $lt: normalizedDate.start } }
    case 'lte':
      return { [key]: { $lt: normalizedDate.endExclusive } }
    case 'eq':
    default:
      return {
        [key]: { $gte: normalizedDate.start, $lt: normalizedDate.endExclusive },
      }
  }
}

function buildRangeColumnFilterClause(
  template: EntityTemplate,
  rangeStart?: string,
  rangeEnd?: string,
  rangeStartOperator: 'gt' | 'gte' = 'gte',
  rangeEndOperator: 'lt' | 'lte' = isDateTemplate(template) ? 'lt' : 'lte',
): FilterQuery {
  const normalizedStart = rangeStart?.trim() ?? ''
  const normalizedEnd = rangeEnd?.trim() ?? ''

  if (isDateTemplate(template)) {
    const rangeClauses: FilterQuery[] = []
    if (normalizedStart) {
      rangeClauses.push(
        buildDateColumnFilterClause(template.name, rangeStartOperator, normalizedStart),
      )
    }
    if (normalizedEnd) {
      rangeClauses.push(buildDateColumnFilterClause(template.name, rangeEndOperator, normalizedEnd))
    }
    if (rangeClauses.length === 0) return {}
    if (rangeClauses.length === 1) return rangeClauses[0]
    return { $and: rangeClauses }
  }

  const conditions: Record<string, string | number | boolean> = {}
  if (normalizedStart) {
    conditions[rangeStartOperator === 'gt' ? '$gt' : '$gte'] = normalizeFilterValue(
      template,
      normalizedStart,
    )
  }
  if (normalizedEnd) {
    conditions[rangeEndOperator === 'lt' ? '$lt' : '$lte'] = normalizeFilterValue(
      template,
      normalizedEnd,
    )
  }
  return { [template.name]: conditions }
}

function buildManyToOneColumnFilterClause(
  template: EntityTemplate,
  relationItems: SaplingGenericItem[],
  operator: ColumnFilterOperator = 'eq',
): FilterQuery {
  const selectedHandles = relationItems
    .map((item) => item?.handle)
    .filter(
      (handle): handle is string | number =>
        typeof handle === 'string' || typeof handle === 'number',
    )
  if (selectedHandles.length === 0) return {}
  if (operator === 'nin') {
    return { [template.name]: { handle: { $nin: selectedHandles } } }
  }
  if (selectedHandles.length === 1) {
    return { [template.name]: { handle: selectedHandles[0] } }
  }
  return { [template.name]: { handle: { $in: selectedHandles } } }
}

function normalizeDateFilterValue(
  rawValue: string,
): { start: string; endExclusive: string; isDateOnly: boolean } | null {
  const value = rawValue.trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const nextDay = new Date(`${value}T00:00:00`)
    nextDay.setDate(nextDay.getDate() + 1)
    return {
      start: value,
      endExclusive: nextDay.toISOString().slice(0, 10),
      isDateOnly: true,
    }
  }

  if (!Number.isNaN(Date.parse(value))) {
    return { start: value, endExclusive: value, isDateOnly: false }
  }
  return null
}
