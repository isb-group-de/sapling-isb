import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import type { SaplingGenericItem } from '@/entity/entity'
import type { ColumnFilterItem, ColumnFilterOperator, EntityTemplate } from '@/entity/structure'
import { normalizeTableColumnTemplate } from './useSaplingTableFilterHelpers'
import { useGenericStore } from '@/stores/genericStore'
import { getEntityValueLabel } from '@/utils/saplingTableUtil'
import ApiGenericService from '@/services/api.generic.service'
import {
  isBooleanTemplate,
  isDateTemplate,
  isManyToOneTemplate,
  isNumericTemplate,
  isRangeTemplate,
  isTimeTemplate,
} from '@/utils/saplingTableUtil'
import type {
  SaplingTableColumnFilterEmit,
  SaplingTableColumnFilterProps,
  SaplingTableFilterInputKind as InputKind,
  SaplingTableFilterVariant as FilterVariant,
} from './saplingTableColumnFilter.types'
import {
  buildReferenceLookupFilter,
  createEmptyFilterState,
  createFilterState,
  formatFilterSummaryValue,
  getDefaultRangeEndOperator,
  getOperatorDescription,
  getRelationLookupKey,
  getTranslatedRelationIdentifier,
  isAllowedOperator,
  isTokenFilterValue,
  isValueLessOperator,
  shouldResolveRelationItem,
} from './saplingTableColumnFilter.utils'

export type { SaplingTableColumnFilterProps } from './saplingTableColumnFilter.types'

const TABLE_FILTER_INPUT_DEBOUNCE_MS = 250

export function useSaplingTableColumnFilter(
  props: SaplingTableColumnFilterProps,
  emit: SaplingTableColumnFilterEmit,
) {
  const { t } = useI18n()
  const { isLoading: isTranslationLoading } = useTranslationLoader('filter', 'person', 'company')
  const genericStore = useGenericStore()
  const isComponentLoading = computed(() => isTranslationLoading.value || props.loading === true)
  const menuOpen = ref(false)
  const resolvedRelationItems = ref<Record<string, SaplingGenericItem>>({})
  let filterEmitTimeout: ReturnType<typeof setTimeout> | null = null
  let latestRelationLookupRequestId = 0

  const normalizedColumn = computed<Partial<EntityTemplate>>(
    () => normalizeTableColumnTemplate(props.column) ?? {},
  )
  const columnOptions = computed(() => normalizedColumn.value.options ?? [])

  const inputKind = computed<InputKind>(() => {
    const columnType = String(normalizedColumn.value.type ?? '').toLowerCase()

    if (isBooleanTemplate(normalizedColumn.value)) return 'boolean'
    if (columnOptions.value.includes('isColor')) return 'color'
    if (columnOptions.value.includes('isIcon')) return 'icon'
    if (columnOptions.value.includes('isMoney')) return 'money'
    if (columnOptions.value.includes('isPercent')) return 'percent'
    if (columnOptions.value.includes('isPhone')) return 'phone'
    if (columnOptions.value.includes('isMail')) return 'mail'
    if (columnOptions.value.includes('isLink')) return 'link'
    if (columnType === 'datetime') return 'datetime'
    if (isDateTemplate(normalizedColumn.value)) return 'date'
    if (isTimeTemplate(normalizedColumn.value)) return 'time'
    if (isNumericTemplate(normalizedColumn.value)) return 'number'

    return 'text'
  })

  const filterVariant = computed<FilterVariant>(() => {
    if (isValueLessOperator(localFilter.value.operator)) {
      return 'single'
    }

    if (inputKind.value === 'boolean') {
      return 'boolean'
    }

    if (inputKind.value === 'icon') {
      return 'icon'
    }

    if (isManyToOneTemplate(normalizedColumn.value)) {
      return 'relation'
    }

    if (isRangeTemplate(normalizedColumn.value) && currentOperator.value === 'between') {
      return 'range'
    }

    return 'single'
  })

  const defaultOperator = computed<ColumnFilterOperator>(
    () => props.operatorOptions[0]?.value ?? 'eq',
  )

  const localFilter = ref<ColumnFilterItem>(
    createFilterState(props.filterItem, defaultOperator.value),
  )
  const activeFilter = computed<ColumnFilterItem>(() => localFilter.value)
  const singleValue = computed(() => activeFilter.value.value)
  const rangeStartValue = computed(() => activeFilter.value.rangeStart ?? '')
  const rangeEndValue = computed(() => activeFilter.value.rangeEnd ?? '')
  const relationItems = computed(() => activeFilter.value.relationItems ?? [])
  const relationDisplayItems = computed(() =>
    relationItems.value.map((item) => {
      const relationLookupKey = getRelationLookupKey(item)
      return relationLookupKey != null
        ? (resolvedRelationItems.value[relationLookupKey] ?? item)
        : item
    }),
  )
  const referenceEntityHandle = computed(() => normalizedColumn.value.referenceName ?? '')
  const referenceTemplates = computed(() => {
    if (!referenceEntityHandle.value) {
      return []
    }

    return genericStore.getState(referenceEntityHandle.value).entityTemplates
  })

  watch(
    [() => props.filterItem, defaultOperator],
    ([filterItem, fallbackOperator]) => {
      cancelPendingFilterEmit()

      if (filterItem) {
        localFilter.value = createFilterState(filterItem, fallbackOperator)
        return
      }

      localFilter.value = createEmptyFilterState(
        isAllowedOperator(props.operatorOptions, localFilter.value.operator)
          ? localFilter.value.operator
          : fallbackOperator,
      )
    },
    { immediate: true },
  )

  watch(
    [referenceEntityHandle, referenceTemplates, relationItems],
    () => {
      void resolveRelationLabels()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    cancelPendingFilterEmit()
    latestRelationLookupRequestId += 1
  })

  const hasValue = computed(() => {
    if (isValueLessOperator(currentOperator.value)) {
      return true
    }

    return (
      singleValue.value.trim().length > 0 ||
      rangeStartValue.value.trim().length > 0 ||
      rangeEndValue.value.trim().length > 0 ||
      relationItems.value.length > 0
    )
  })

  const currentOperator = computed(() => {
    return (
      props.operatorOptions.find((option) => option.value === activeFilter.value.operator)?.value ??
      props.operatorOptions[0]?.value ??
      'eq'
    )
  })

  const currentOperatorLabel = computed(() => {
    return (
      props.operatorOptions.find((option) => option.value === currentOperator.value)?.label ?? '='
    )
  })

  const isOperatorSelectable = computed(
    () => props.operatorOptions.length > 1 && !['boolean', 'icon'].includes(filterVariant.value),
  )

  const operatorItems = computed(() =>
    props.operatorOptions.map((option) => ({
      title: getOperatorDescription(option.value, t),
      value: option.value,
      symbol: option.label,
    })),
  )

  const inputType = computed(() => {
    const shouldUseTextInputForDynamicValue =
      ['date', 'datetime', 'time'].includes(inputKind.value) &&
      [singleValue.value, rangeStartValue.value, rangeEndValue.value].some(isTokenFilterValue)

    if (shouldUseTextInputForDynamicValue) {
      return 'text'
    }

    switch (inputKind.value) {
      case 'color':
        return 'color'
      case 'mail':
        return 'email'
      case 'phone':
        return 'tel'
      case 'link':
        return 'url'
      case 'date':
        return 'date'
      case 'datetime':
        return 'datetime-local'
      case 'time':
        return 'time'
      case 'number':
      case 'money':
      case 'percent':
        return 'number'
      default:
        return 'text'
    }
  })

  const singleValueLabel = computed(() => {
    switch (inputKind.value) {
      case 'color':
        return t('filter.color')
      default:
        return t('filter.value')
    }
  })

  const rangeStartPlaceholder = computed(() => {
    if (['number', 'money', 'percent'].includes(inputKind.value)) {
      return t('filter.minimum')
    }

    return t('filter.start')
  })

  const rangeEndPlaceholder = computed(() => {
    if (['number', 'money', 'percent'].includes(inputKind.value)) {
      return t('filter.maximum')
    }

    return t('filter.end')
  })

  const inputPrefix = computed(() => (inputKind.value === 'money' ? 'EUR' : undefined))
  const inputSuffix = computed(() => (inputKind.value === 'percent' ? '%' : undefined))
  const inputStep = computed(() =>
    ['number', 'money', 'percent'].includes(inputKind.value) ? 'any' : undefined,
  )
  const isClearableField = computed(
    () => !['color', 'date', 'datetime', 'time'].includes(inputKind.value),
  )

  const filterSummary = computed(() => {
    if (!hasValue.value) {
      return t('filter.noFilter')
    }

    if (currentOperator.value === 'isSet') {
      return t('filter.hasValue')
    }

    if (currentOperator.value === 'isEmpty') {
      return t('filter.isEmpty')
    }

    if (filterVariant.value === 'range') {
      if (rangeStartValue.value && rangeEndValue.value) {
        return `${formatFilterSummaryValue(rangeStartValue.value, t)} ${t('filter.to').toLowerCase()} ${formatFilterSummaryValue(rangeEndValue.value, t)}`
      }

      if (rangeStartValue.value) {
        return `${t('filter.from').toLowerCase()} ${formatFilterSummaryValue(rangeStartValue.value, t)}`
      }

      if (rangeEndValue.value) {
        return `${t('filter.to').toLowerCase()} ${formatFilterSummaryValue(rangeEndValue.value, t)}`
      }
    }

    if (filterVariant.value === 'relation') {
      if (relationItems.value.length === 1) {
        return getRelationItemSummary(relationItems.value[0])
      }

      return t('filter.selectedCount', { count: relationItems.value.length })
    }

    if (filterVariant.value === 'boolean') {
      return singleValue.value === 'true' ? t('filter.yes') : t('filter.no')
    }

    return formatFilterSummaryValue(singleValue.value, t)
  })

  function updateOperator(value: ColumnFilterOperator | null) {
    if (!value) {
      return
    }

    if (value === 'between') {
      emitFilter(
        {
          operator: value,
          value: '',
          rangeStart: rangeStartValue.value || singleValue.value,
          rangeEnd: rangeEndValue.value,
          rangeStartOperator: localFilter.value.rangeStartOperator ?? 'gte',
          rangeEndOperator:
            localFilter.value.rangeEndOperator ?? getDefaultRangeEndOperator(inputKind.value),
        },
        { debounce: false },
      )
      return
    }

    if (currentOperator.value === 'between') {
      emitFilter(
        {
          operator: value,
          value: rangeStartValue.value || rangeEndValue.value || singleValue.value,
          rangeStart: undefined,
          rangeEnd: undefined,
          rangeStartOperator: undefined,
          rangeEndOperator: undefined,
        },
        { debounce: false },
      )
      return
    }

    emitFilter({ operator: value }, { debounce: false })
  }

  function updateSingleValue(value: string) {
    emitFilter({ value }, { debounce: true })
  }

  function updateRangeStart(value: string) {
    emitFilter({ rangeStart: value }, { debounce: true })
  }

  function updateRangeEnd(value: string) {
    emitFilter({ rangeEnd: value }, { debounce: true })
  }

  function updateRelationItems(value: ColumnFilterItem['relationItems']) {
    emitFilter({ relationItems: value?.map((item) => ({ ...item })) ?? [] }, { debounce: false })
  }

  function clearFilter() {
    cancelPendingFilterEmit()
    localFilter.value = createEmptyFilterState(defaultOperator.value)
    emit('update:filter', null)
    menuOpen.value = false
  }

  function emitFilter(patch: Partial<ColumnFilterItem>, { debounce }: { debounce: boolean }) {
    const nextFilter: ColumnFilterItem = {
      operator: currentOperator.value,
      value: singleValue.value,
      rangeStart: rangeStartValue.value,
      rangeEnd: rangeEndValue.value,
      rangeStartOperator: localFilter.value.rangeStartOperator ?? 'gte',
      rangeEndOperator:
        localFilter.value.rangeEndOperator ?? getDefaultRangeEndOperator(inputKind.value),
      relationItems: relationItems.value.map((item) => ({ ...item })),
      ...patch,
    }

    if (isValueLessOperator(nextFilter.operator)) {
      nextFilter.value = ''
      nextFilter.rangeStart = undefined
      nextFilter.rangeEnd = undefined
      nextFilter.rangeStartOperator = undefined
      nextFilter.rangeEndOperator = undefined
      nextFilter.relationItems = undefined
    } else if (filterVariant.value === 'relation') {
      nextFilter.value = ''
      nextFilter.rangeStart = undefined
      nextFilter.rangeEnd = undefined
      nextFilter.rangeStartOperator = undefined
      nextFilter.rangeEndOperator = undefined
    } else if (filterVariant.value === 'range' || nextFilter.operator === 'between') {
      nextFilter.value = ''
      nextFilter.relationItems = undefined
      nextFilter.rangeStartOperator = nextFilter.rangeStartOperator ?? 'gte'
      nextFilter.rangeEndOperator =
        nextFilter.rangeEndOperator ?? getDefaultRangeEndOperator(inputKind.value)
    } else {
      nextFilter.rangeStart = undefined
      nextFilter.rangeEnd = undefined
      nextFilter.rangeStartOperator = undefined
      nextFilter.rangeEndOperator = undefined
      nextFilter.relationItems = undefined
      nextFilter.value = nextFilter.value.trim()
    }

    nextFilter.operator = props.operatorOptions.some(
      (option) => option.value === nextFilter.operator,
    )
      ? nextFilter.operator
      : defaultOperator.value

    nextFilter.rangeStart = nextFilter.rangeStart?.trim() || undefined
    nextFilter.rangeEnd = nextFilter.rangeEnd?.trim() || undefined
    nextFilter.relationItems = nextFilter.relationItems?.length
      ? nextFilter.relationItems.map((item) => ({ ...item }))
      : undefined

    const isEmpty =
      !isValueLessOperator(nextFilter.operator) &&
      nextFilter.value.length === 0 &&
      (nextFilter.rangeStart?.length ?? 0) === 0 &&
      (nextFilter.rangeEnd?.length ?? 0) === 0 &&
      (nextFilter.relationItems?.length ?? 0) === 0

    localFilter.value = isEmpty
      ? createEmptyFilterState(nextFilter.operator)
      : createFilterState(nextFilter, defaultOperator.value)

    if (!debounce) {
      cancelPendingFilterEmit()
      emit('update:filter', isEmpty ? null : nextFilter)
      return
    }

    cancelPendingFilterEmit()
    filterEmitTimeout = setTimeout(() => {
      filterEmitTimeout = null
      emit('update:filter', isEmpty ? null : nextFilter)
    }, TABLE_FILTER_INPUT_DEBOUNCE_MS)
  }

  function cancelPendingFilterEmit() {
    if (filterEmitTimeout) {
      clearTimeout(filterEmitTimeout)
      filterEmitTimeout = null
    }
  }

  function getRelationItemSummary(item: SaplingGenericItem) {
    const relationLookupKey = getRelationLookupKey(item)
    const resolvedRelationItem =
      relationLookupKey != null ? resolvedRelationItems.value[relationLookupKey] : undefined

    if (resolvedRelationItem) {
      return getEntityValueLabel(resolvedRelationItem, referenceTemplates.value)
    }

    const translatedIdentifier = getTranslatedRelationIdentifier(item, t)
    if (translatedIdentifier) {
      return translatedIdentifier
    }

    return getEntityValueLabel(item, referenceTemplates.value)
  }

  async function resolveRelationLabels() {
    const currentReferenceEntityHandle = referenceEntityHandle.value.trim()
    if (!currentReferenceEntityHandle || relationItems.value.length === 0) {
      resolvedRelationItems.value = {}
      return
    }

    const itemsToResolve = relationItems.value.filter((item) =>
      shouldResolveRelationItem(item, referenceTemplates.value),
    )

    if (itemsToResolve.length === 0) {
      resolvedRelationItems.value = {}
      return
    }

    const lookupFilter = buildReferenceLookupFilter(itemsToResolve)
    if (!lookupFilter) {
      resolvedRelationItems.value = {}
      return
    }

    const requestId = ++latestRelationLookupRequestId

    try {
      const result = await ApiGenericService.findAll<SaplingGenericItem>(
        currentReferenceEntityHandle,
        {
          filter: lookupFilter,
        },
      )

      if (requestId !== latestRelationLookupRequestId) {
        return
      }

      const nextResolvedRelationItems: Record<string, SaplingGenericItem> = {}
      result.forEach((item) => {
        const lookupKey = getRelationLookupKey(item)
        if (lookupKey) {
          nextResolvedRelationItems[lookupKey] = item
        }
      })

      resolvedRelationItems.value = nextResolvedRelationItems
    } catch {
      if (requestId !== latestRelationLookupRequestId) {
        return
      }

      resolvedRelationItems.value = {}
    }
  }

  return {
    clearFilter,
    currentOperator,
    currentOperatorLabel,
    filterSummary,
    filterVariant,
    hasValue,
    inputPrefix,
    inputStep,
    inputSuffix,
    inputType,
    isClearableField,
    isComponentLoading,
    isOperatorSelectable,
    menuOpen,
    operatorItems,
    rangeEndPlaceholder,
    rangeEndValue,
    rangeStartPlaceholder,
    rangeStartValue,
    referenceEntityHandle,
    relationDisplayItems,
    relationItems,
    singleValue,
    singleValueLabel,
    updateOperator,
    updateRangeEnd,
    updateRangeStart,
    updateRelationItems,
    updateSingleValue,
  }
}
