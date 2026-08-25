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

export function getTranslatedRelationIdentifier(item: SaplingGenericItem, t: TranslationFunction) {
  const handle = item.handle
  if (typeof handle !== 'string') return ''
  const tokenPath = extractDynamicFilterTokenPath(handle)
  return tokenPath ? translateDynamicFilterTokenPath(tokenPath, t) : ''
}

export function shouldResolveRelationItem(
  item: SaplingGenericItem,
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

  const handle = item.handle
  return (
    (typeof handle === 'string' && handle.trim().length > 0 && !isTokenFilterValue(handle)) ||
    typeof handle === 'number'
  )
}

export function buildReferenceLookupFilter(items: SaplingGenericItem[]) {
  const handles = items
    .map((item) => getRelationHandle(item))
    .filter((handle): handle is string | number => handle !== null)
  if (handles.length === 0) return null
  if (handles.length === 1) return { handle: handles[0] }
  return { handle: { $in: handles } }
}

export function getRelationLookupKey(item: SaplingGenericItem) {
  const handle = getRelationHandle(item)
  return handle == null ? null : JSON.stringify({ handle })
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

function getRelationHandle(item: SaplingGenericItem): string | number | null {
  const handle = item.handle
  if (typeof handle === 'string') {
    return handle.trim() && !isTokenFilterValue(handle) ? handle : null
  }
  return typeof handle === 'number' ? handle : null
}
