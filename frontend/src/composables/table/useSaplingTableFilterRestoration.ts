import type { Ref } from 'vue'
import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import {
  extractColumnFiltersFromFilterQuery,
  removeMatchingFilterFromFilterQuery,
  removeRestoredColumnFiltersFromFilterQuery,
  removeUnavailableFieldFilters,
} from './useSaplingTableFilterHelpers'
import {
  buildDefaultOpenChipColumnFilter,
  buildRouteSearchFilterCandidates,
  isOpenChipReferenceTemplate,
} from './saplingTableData.utils'
import type { SaplingTableRouteState } from './saplingTableRouteState'
import { i18n } from '@/i18n'

type PushMessage = (
  type: 'success' | 'info' | 'warning' | 'error',
  message: string,
  description: string,
  entity: string,
  technical?: unknown,
  descriptionParams?: Record<string, unknown>,
) => void

export function useSaplingTableFilterRestoration(options: {
  columnFilters: Ref<Record<string, ColumnFilterItem>>
  parentFilter: Ref<Record<string, unknown>>
  getRouteState: () => SaplingTableRouteState
  entityHandle: Ref<string>
  pushMessage: PushMessage
  searchFieldNames?: string[]
}) {
  const { columnFilters, parentFilter, getRouteState, entityHandle, pushMessage } = options
  const behaviorOptions = { searchFieldNames: options.searchFieldNames }

  function restoreQueryFilterState(nextEntityTemplates: EntityTemplate[]) {
    const routeState = getRouteState()
    const sanitizedRouteFilter = removeUnavailableFieldFilters(
      routeState.filter,
      nextEntityTemplates,
    )
    const routeFilter = sanitizedRouteFilter.filter ?? {}
    if (sanitizedRouteFilter.removed) {
      pushMessage(
        'info',
        i18n.global.t('permission.filterAdjusted'),
        i18n.global.t('permission.filterAdjustedDescription'),
        entityHandle.value,
      )
    }
    const searchFilters = buildRouteSearchFilterCandidates(
      routeState.search,
      nextEntityTemplates,
      behaviorOptions.searchFieldNames,
    )
    const filterWithoutSearch = searchFilters.reduce<unknown>(
      (filter, searchFilter) => removeMatchingFilterFromFilterQuery(filter, searchFilter),
      routeFilter,
    )

    columnFilters.value = extractColumnFiltersFromFilterQuery(nextEntityTemplates, routeFilter)
    parentFilter.value =
      removeRestoredColumnFiltersFromFilterQuery(nextEntityTemplates, filterWithoutSearch) ?? {}
  }

  async function applyDefaultOpenChipColumnFilters(nextEntityTemplates: EntityTemplate[]) {
    const chipReferenceTemplates = nextEntityTemplates.filter(isOpenChipReferenceTemplate)

    if (chipReferenceTemplates.length === 0) {
      return
    }

    const defaultFilters = await Promise.all(
      chipReferenceTemplates.map((template) => buildDefaultOpenChipColumnFilter(template)),
    )

    defaultFilters.forEach((filter) => {
      if (!filter || columnFilters.value[filter.key]) {
        return
      }

      columnFilters.value = {
        ...columnFilters.value,
        [filter.key]: filter.value,
      }
    })
  }

  return { applyDefaultOpenChipColumnFilters, restoreQueryFilterState }
}
