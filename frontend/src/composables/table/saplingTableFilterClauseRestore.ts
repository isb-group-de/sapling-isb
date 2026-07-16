import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import {
  getAllowedColumnFilterOperators,
  getDefaultColumnFilterOperatorForTemplate,
  isDateTemplate,
  isManyToOneTemplate,
  isRangeTemplate,
} from '@/utils/saplingTableUtil'
import { isEmptyColumnFilterItem } from './saplingTableColumnFilterState'

export function restoreColumnFilterFromClause(
  template: EntityTemplate,
  rawValue: unknown,
): Partial<ColumnFilterItem> | null {
  if (isManyToOneTemplate(template)) {
    const relationFilter = restoreRelationFilter(template, rawValue)
    if (relationFilter) {
      return relationFilter
    }
  }

  if (typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
    if (rawValue === null) {
      return {
        operator: 'isEmpty',
      }
    }

    if (
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean'
    ) {
      return {
        operator: 'eq',
        value: String(rawValue),
      }
    }

    return null
  }

  const operatorValue = rawValue as Record<string, unknown>

  if (typeof operatorValue.$ilike === 'string') {
    return parseLikeOperatorFilter(operatorValue.$ilike)
  }

  if ('$ne' in operatorValue && operatorValue.$ne === null) {
    return {
      operator: 'isSet',
    }
  }

  if ('$eq' in operatorValue && operatorValue.$eq === null) {
    return {
      operator: 'isEmpty',
    }
  }

  if (isRangeTemplate(template)) {
    const restoredRangeFilter = restoreRangeFilter(template, operatorValue)
    if (restoredRangeFilter) {
      return restoredRangeFilter
    }
  }

  if (Object.keys(operatorValue).length > 1) {
    return null
  }

  const restoredOperators = (['eq', 'gt', 'gte', 'lt', 'lte'] as const)
    .map((operator) => ({
      operator,
      value: operatorValue[`$${operator}`],
    }))
    .filter(
      (
        entry,
      ): entry is {
        operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte'
        value: string | number | boolean
      } =>
        typeof entry.value === 'string' ||
        typeof entry.value === 'number' ||
        typeof entry.value === 'boolean',
    )

  if (restoredOperators.length === 1) {
    return {
      operator: restoredOperators[0].operator,
      value: String(restoredOperators[0].value),
    }
  }

  return null
}

function restoreRelationFilter(
  template: EntityTemplate,
  rawValue: unknown,
): Partial<ColumnFilterItem> | null {
  if (typeof rawValue !== 'object' || rawValue === null) {
    const relationItem = createRelationFilterItem(template, rawValue)
    return relationItem
      ? {
          operator: 'eq',
          relationItems: [relationItem],
        }
      : null
  }

  if (Array.isArray(rawValue)) {
    return null
  }

  const operatorValue = rawValue as Record<string, unknown>

  if (Array.isArray(operatorValue.$in)) {
    const relationItems = operatorValue.$in
      .map((item) => createRelationFilterItem(template, item))
      .filter((item): item is SaplingGenericItem => item !== null)

    if (relationItems.length > 0) {
      return {
        operator: 'eq',
        relationItems,
      }
    }

    return null
  }

  const nestedIdentifierOperator = restoreRelationIdentifierOperatorFilter(template, operatorValue)
  if (nestedIdentifierOperator) {
    return nestedIdentifierOperator
  }

  if (Object.keys(operatorValue).some((key) => key.startsWith('$'))) {
    return null
  }

  if (!isRoundTrippableRelationIdentifier(template, operatorValue)) {
    return null
  }

  const relationItem = createRelationFilterItem(template, rawValue)
  return relationItem
    ? {
        operator: 'eq',
        relationItems: [relationItem],
      }
    : null
}

function restoreRangeFilter(
  template: EntityTemplate,
  operatorValue: Record<string, unknown>,
): Partial<ColumnFilterItem> | null {
  if (isDateTemplate(template)) {
    const restoredDateEquality = restoreDateEqualityFilter(operatorValue)
    if (restoredDateEquality) {
      return restoredDateEquality
    }
  }

  return restoreBetweenFilter(template, operatorValue)
}

function restoreDateEqualityFilter(
  operatorValue: Record<string, unknown>,
): Partial<ColumnFilterItem> | null {
  if (typeof operatorValue.$gte !== 'string' || typeof operatorValue.$lt !== 'string') {
    return null
  }

  const start = operatorValue.$gte.trim()
  const endExclusive = operatorValue.$lt.trim()
  if (!isDateOnlyValue(start) || !isDateOnlyValue(endExclusive)) {
    return null
  }

  const nextDay = new Date(`${start}T00:00:00`)
  nextDay.setDate(nextDay.getDate() + 1)

  if (nextDay.toISOString().slice(0, 10) !== endExclusive) {
    return null
  }

  return {
    operator: 'eq',
    value: start,
  }
}

function parseLikeOperatorFilter(value: string): Partial<ColumnFilterItem> {
  const startsWithWildcard = value.startsWith('%')
  const endsWithWildcard = value.endsWith('%')

  if (startsWithWildcard && endsWithWildcard && value.length >= 2) {
    return {
      operator: 'like',
      value: value.slice(1, -1),
    }
  }

  if (endsWithWildcard) {
    return {
      operator: 'startsWith',
      value: value.slice(0, -1),
    }
  }

  if (startsWithWildcard) {
    return {
      operator: 'endsWith',
      value: value.slice(1),
    }
  }

  return {
    operator: 'like',
    value,
  }
}

export function createRelationFilterItem(
  template: EntityTemplate,
  rawValue: unknown,
): SaplingGenericItem | null {
  if (isRoundTrippableRelationIdentifier(template, rawValue)) {
    return { ...(rawValue as Record<string, unknown>) }
  }

  if (
    typeof rawValue !== 'string' &&
    typeof rawValue !== 'number' &&
    typeof rawValue !== 'boolean'
  ) {
    return null
  }

  const identifierKey = template.referencedPks?.[0] ?? 'handle'
  return {
    [identifierKey]: rawValue,
  }
}

function restoreRelationIdentifierOperatorFilter(
  template: EntityTemplate,
  operatorValue: Record<string, unknown>,
): Partial<ColumnFilterItem> | null {
  const identifierKeys = template.referencedPks?.length ? template.referencedPks : ['handle', 'id']
  if (identifierKeys.length !== 1) {
    return null
  }

  const identifierKey = identifierKeys[0]
  const nestedValue = operatorValue[identifierKey]

  if (
    typeof nestedValue === 'string' ||
    typeof nestedValue === 'number' ||
    typeof nestedValue === 'boolean'
  ) {
    return {
      operator: 'eq',
      relationItems: [{ [identifierKey]: nestedValue }],
    }
  }

  if (typeof nestedValue !== 'object' || nestedValue === null || Array.isArray(nestedValue)) {
    return null
  }

  const nestedOperatorValue = nestedValue as Record<string, unknown>

  if (Array.isArray(nestedOperatorValue.$in)) {
    return {
      operator: 'eq',
      relationItems: nestedOperatorValue.$in
        .filter(isScalarFilterValue)
        .map((value) => ({ [identifierKey]: value })),
    }
  }

  if (Array.isArray(nestedOperatorValue.$nin)) {
    return {
      operator: 'nin',
      relationItems: nestedOperatorValue.$nin
        .filter(isScalarFilterValue)
        .map((value) => ({ [identifierKey]: value })),
    }
  }

  return null
}

function restoreBetweenFilter(
  template: EntityTemplate,
  operatorValue: Record<string, unknown>,
): Partial<ColumnFilterItem> | null {
  const rangeStart = parseComparableRangeValue(template, operatorValue.$gt ?? operatorValue.$gte)
  const rangeEnd = parseComparableRangeValue(template, operatorValue.$lt ?? operatorValue.$lte)
  const rangeStartOperator =
    typeof operatorValue.$gt !== 'undefined'
      ? 'gt'
      : typeof operatorValue.$gte !== 'undefined'
        ? 'gte'
        : undefined
  const rangeEndOperator =
    typeof operatorValue.$lt !== 'undefined'
      ? 'lt'
      : typeof operatorValue.$lte !== 'undefined'
        ? 'lte'
        : undefined

  if (!rangeStartOperator && !rangeEndOperator) {
    return null
  }

  if (rangeStartOperator && rangeEndOperator) {
    return {
      operator: 'between',
      rangeStart,
      rangeEnd,
      rangeStartOperator,
      rangeEndOperator,
    }
  }

  if (rangeStart && rangeStartOperator) {
    return {
      operator: rangeStartOperator,
      value: rangeStart,
    }
  }

  if (rangeEnd && rangeEndOperator) {
    return {
      operator: rangeEndOperator,
      value: rangeEnd,
    }
  }

  return null
}

function isRoundTrippableRelationIdentifier(template: EntityTemplate, rawValue: unknown) {
  if (typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
    return false
  }

  const identifier = rawValue as Record<string, unknown>
  if (Object.keys(identifier).some((key) => key.startsWith('$'))) {
    return false
  }

  const identifierKeys = template.referencedPks?.length
    ? template.referencedPks
    : ['handle', 'id'].filter((key) => key in identifier)

  if (identifierKeys.length === 0) {
    return false
  }

  return identifierKeys.every((key) => isScalarFilterValue(identifier[key]))
}

function isScalarFilterValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

export function normalizeRestoredColumnFilter(
  template: EntityTemplate,
  filter: Partial<ColumnFilterItem>,
): ColumnFilterItem | null {
  const normalizedFilter: ColumnFilterItem = {
    operator: getDefaultColumnFilterOperatorForTemplate(template),
    value: '',
  }

  if (filter.operator && getAllowedColumnFilterOperators(template).includes(filter.operator)) {
    normalizedFilter.operator = filter.operator
  }

  if (filter.relationItems?.length) {
    normalizedFilter.relationItems = filter.relationItems.map((item) => ({ ...item }))
    normalizedFilter.value = ''
  } else if (filter.rangeStart || filter.rangeEnd) {
    normalizedFilter.rangeStart = filter.rangeStart?.trim() || undefined
    normalizedFilter.rangeEnd = filter.rangeEnd?.trim() || undefined
    normalizedFilter.rangeStartOperator = filter.rangeStartOperator
    normalizedFilter.rangeEndOperator = filter.rangeEndOperator
    normalizedFilter.value = ''
  } else if (typeof filter.value === 'string') {
    normalizedFilter.value = normalizeRestoredFilterInputValue(template, filter.value)
  }

  if (isEmptyColumnFilterItem(normalizedFilter)) {
    return null
  }

  return normalizedFilter
}

function isDateOnlyValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTokenFilterValue(value: string) {
  return /^\{\{\s*[^}]+?\s*\}\}$/.test(value.trim())
}

function parseComparableRangeValue(template: EntityTemplate, value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return undefined
  }

  const normalizedValue = normalizeRestoredFilterInputValue(template, String(value))
  return normalizedValue || undefined
}

function normalizeRestoredFilterInputValue(template: EntityTemplate, rawValue: string) {
  const value = rawValue.trim()
  if (!value || !isDateTemplate(template) || isTokenFilterValue(value)) {
    return value
  }

  if (isDateOnlyValue(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (normalizeTemplateType(template) === 'datetime') {
    return (
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-') +
      `T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    )
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function normalizeTemplateType(template?: Partial<EntityTemplate>) {
  return String(template?.type ?? '').toLowerCase()
}
