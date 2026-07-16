import type { SaplingGenericItem } from '@/entity/entity'
import type { ColumnFilterItem, ColumnFilterOperator, EntityTemplate } from '@/entity/structure'
import type { SaplingTableFilterInputKind } from './saplingTableColumnFilter.types'

type TranslationFunction = (key: string, values?: Record<string, unknown>) => string

export function createFilterState(
  filterItem: ColumnFilterItem | null | undefined,
  fallbackOperator: ColumnFilterOperator,
): ColumnFilterItem {
  return {
    operator: filterItem?.operator ?? fallbackOperator,
    value: filterItem?.value ?? '',
    rangeStart: filterItem?.rangeStart ?? '',
    rangeEnd: filterItem?.rangeEnd ?? '',
    rangeStartOperator: filterItem?.rangeStartOperator,
    rangeEndOperator: filterItem?.rangeEndOperator,
    relationItems: filterItem?.relationItems?.map((item) => ({ ...item })) ?? [],
  }
}

export function createEmptyFilterState(operator: ColumnFilterOperator): ColumnFilterItem {
  return {
    operator,
    value: '',
    rangeStart: '',
    rangeEnd: '',
    rangeStartOperator: undefined,
    rangeEndOperator: undefined,
    relationItems: [],
  }
}

export function getOperatorDescription(operator: ColumnFilterOperator, t: TranslationFunction) {
  const translationKeys: Partial<Record<ColumnFilterOperator, string>> = {
    like: 'filter.contains',
    startsWith: 'filter.startsWith',
    endsWith: 'filter.endsWith',
    eq: 'filter.isEqual',
    between: 'filter.isBetween',
    gt: 'filter.isGreaterThan',
    gte: 'filter.isGreaterThanOrEqualTo',
    lt: 'filter.isLessThan',
    lte: 'filter.isLessThanOrEqualTo',
    nin: 'filter.isNotIn',
    isSet: 'filter.hasValue',
    isEmpty: 'filter.isEmpty',
  }
  const translationKey = translationKeys[operator]
  return translationKey ? t(translationKey) : operator
}

export function isAllowedOperator(
  operatorOptions: Array<{ label: string; value: ColumnFilterOperator }>,
  operator: ColumnFilterOperator,
) {
  return operatorOptions.some((option) => option.value === operator)
}

export function formatFilterSummaryValue(value: string, t: TranslationFunction) {
  const tokenPath = extractDynamicFilterTokenPath(value)
  return tokenPath ? translateDynamicFilterTokenPath(tokenPath, t) : value
}

export function isTokenFilterValue(value: string) {
  return /^\{\{\s*[^}]+?\s*\}\}$/.test(value.trim())
}

export function isValueLessOperator(operator: ColumnFilterOperator) {
  return operator === 'isSet' || operator === 'isEmpty'
}

export function getDefaultRangeEndOperator(inputKind: SaplingTableFilterInputKind): 'lt' | 'lte' {
  return ['date', 'datetime', 'time'].includes(inputKind) ? 'lt' : 'lte'
}

export function getTranslatedRelationIdentifier(
  item: SaplingGenericItem,
  identifierKeys: string[],
  t: TranslationFunction,
) {
  const translatedValues = identifierKeys
    .map((key) => item?.[key])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => {
      const tokenPath = extractDynamicFilterTokenPath(value)
      return tokenPath ? translateDynamicFilterTokenPath(tokenPath, t) : ''
    })
    .filter(Boolean)
  return translatedValues[0] ?? ''
}

export function shouldResolveRelationItem(
  item: SaplingGenericItem,
  identifierKeys: string[],
  referenceTemplates: EntityTemplate[],
) {
  const hasTranslatableValueField = referenceTemplates
    .filter((template) => template.options?.includes('isValue'))
    .some((template) => {
      const value = item?.[template.name]
      return (
        (typeof value === 'string' && value.trim().length > 0) ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      )
    })
  if (hasTranslatableValueField) return false

  return identifierKeys.some((key) => {
    const value = item?.[key]
    return (
      (typeof value === 'string' && value.trim().length > 0 && !isTokenFilterValue(value)) ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
  })
}

export function buildReferenceLookupFilter(items: SaplingGenericItem[], identifierKeys: string[]) {
  const relationIdentifiers = items
    .map((item) => buildRelationIdentifier(item, identifierKeys))
    .filter(
      (identifier): identifier is Record<string, string | number | boolean> => identifier !== null,
    )
  if (relationIdentifiers.length === 0) return null

  if (identifierKeys.length === 1) {
    const identifierKey = identifierKeys[0]
    const values = relationIdentifiers
      .map((identifier) => identifier[identifierKey])
      .filter((value): value is string | number | boolean => typeof value !== 'undefined')
    if (values.length === 0) return null
    if (values.length === 1) return { [identifierKey]: values[0] }
    return { [identifierKey]: { $in: values } }
  }
  if (relationIdentifiers.length === 1) return relationIdentifiers[0]
  return { $or: relationIdentifiers }
}

export function getRelationLookupKey(item: SaplingGenericItem, identifierKeys: string[]) {
  const identifier = buildRelationIdentifier(item, identifierKeys)
  return identifier ? JSON.stringify(identifier) : null
}

function extractDynamicFilterTokenPath(value: string) {
  const tokenMatch = value.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/)
  return tokenMatch?.[1]?.trim() ?? null
}

function translateDynamicFilterTokenPath(tokenPath: string, t: TranslationFunction) {
  const translationKeys: Record<string, string> = {
    'today.start': 'filter.todayStart',
    'tomorrow.start': 'filter.tomorrowStart',
    'dayAfterTomorrow.start': 'filter.dayAfterTomorrowStart',
    'week.start': 'filter.weekStart',
    'week.end': 'filter.weekEnd',
    'month.start': 'filter.monthStart',
    'month.end': 'filter.monthEnd',
    now: 'filter.now',
  }
  const translationKey = translationKeys[tokenPath]
  return translationKey ? t(translationKey) : translateScopedDynamicFilterToken(tokenPath, t)
}

function translateScopedDynamicFilterToken(tokenPath: string, t: TranslationFunction) {
  const scopes = [
    ['currentUser.company.', 'filter.currentCompany', 'company'],
    ['currentCompany.', 'filter.currentCompany', 'company'],
    ['currentUser.', 'filter.currentUser', 'person'],
    ['currentPerson.', 'filter.currentUser', 'person'],
  ] as const
  const scope = scopes.find(([prefix]) => tokenPath.startsWith(prefix))
  if (!scope) return tokenPath
  return formatScopedDynamicFilterToken(scope[1], scope[2], tokenPath.slice(scope[0].length), t)
}

function formatScopedDynamicFilterToken(
  scopeKey: string,
  entityKey: string,
  propertyKey: string,
  t: TranslationFunction,
) {
  return propertyKey.trim() ? `${t(scopeKey)}: ${t(`${entityKey}.${propertyKey}`)}` : t(scopeKey)
}

function buildRelationIdentifier(item: SaplingGenericItem, identifierKeys: string[]) {
  const identifier: Record<string, string | number | boolean> = {}
  for (const key of identifierKeys) {
    const value = item?.[key]
    if (typeof value === 'string') {
      if (!value.trim() || isTokenFilterValue(value)) return null
      identifier[key] = value
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      identifier[key] = value
      continue
    }
    return null
  }
  return identifier
}
