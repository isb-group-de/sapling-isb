import { computed, type ComputedRef, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ColumnFilterItem, EntityTemplate, SortItem } from '@/entity/structure'
import { buildTableFilter } from '@/utils/saplingTableUtil'
import {
  getSaplingTableRouteStateSignature,
  readSaplingTableRouteState,
  replaceSaplingTableUrlState,
} from './saplingTableRouteState'

export function useSaplingTableQueryState(options: {
  route: ReturnType<typeof useRoute>
  isUseQueryParameter?: boolean
  entityHandle: Ref<string>
  search: Ref<string>
  page: Ref<number>
  itemsPerPage: Ref<number>
  itemsPerPageDefault: Ref<number>
  sortBy: Ref<SortItem[]>
  columnFilters: Ref<Record<string, ColumnFilterItem>>
  parentFilter: Ref<Record<string, unknown>>
  entityTemplates: ComputedRef<EntityTemplate[]>
  referenceSearchTemplates: ComputedRef<Record<string, EntityTemplate[]>>
  listProjectionFields: ComputedRef<string[]>
  searchFieldNames?: string[]
}) {
  const {
    route,
    isUseQueryParameter,
    entityHandle,
    search,
    page,
    itemsPerPage,
    itemsPerPageDefault,
    sortBy,
    columnFilters,
    parentFilter,
    entityTemplates,
    referenceSearchTemplates,
    listProjectionFields,
    searchFieldNames,
  } = options
  const behaviorOptions = { searchFieldNames }

  const getRouteState = () => readSaplingTableRouteState(route.query, Boolean(isUseQueryParameter))
  const routeStateSignature = computed(() =>
    getSaplingTableRouteStateSignature(route.query, Boolean(isUseQueryParameter)),
  )

  const activeFilter = computed(() =>
    buildTableFilter({
      search: search.value,
      columnFilters: columnFilters.value,
      entityTemplates: entityTemplates.value,
      referenceSearchTemplates: referenceSearchTemplates.value,
      searchFieldNames: behaviorOptions.searchFieldNames,
      parentFilter: parentFilter.value,
    }),
  )
  const urlFilter = computed(() =>
    buildTableFilter({
      columnFilters: columnFilters.value,
      entityTemplates: entityTemplates.value,
      parentFilter: parentFilter.value,
    }),
  )

  const validSortBy = computed(() => {
    const validTemplateKeys = new Set(
      entityTemplates.value
        .filter(
          (template) =>
            template.isPersistent !== false && template.fieldAccess?.allowRead !== false,
        )
        .map((template) => template.name),
    )
    return sortBy.value.filter((sortItem) => validTemplateKeys.has(sortItem.key))
  })

  // Stable serialization of the dynamic query inputs. Watching this avoids
  // `deep: true` traversal on every keystroke and only fires the reload when
  // the effective filter/sort/pagination payload truly changes.
  const tableQuerySignature = computed(() =>
    JSON.stringify({
      entityHandle: entityHandle.value,
      search: search.value,
      page: page.value,
      itemsPerPage: itemsPerPage.value,
      sortBy: validSortBy.value,
      filter: activeFilter.value,
      fields: listProjectionFields.value,
    }),
  )

  /**
   * Applies the first template-defined default ordering to the server query.
   */
  function initialSort(nextEntityTemplates = entityTemplates.value, useRouteSort = true) {
    const urlSortBy = useRouteSort ? getRouteState().sortBy : []
    if (urlSortBy.length > 0) {
      sortBy.value = urlSortBy
      return
    }

    const orderColumn = nextEntityTemplates.find(
      (template) =>
        template.fieldAccess?.allowRead !== false &&
        Array.isArray(template.options) &&
        (template.options.includes('isOrderASC') || template.options.includes('isOrderDESC')),
    )

    if (!orderColumn || !Array.isArray(orderColumn.options)) {
      sortBy.value = []
      return
    }

    sortBy.value = [
      {
        key: orderColumn.name,
        order: orderColumn.options.includes('isOrderDESC') ? 'desc' : 'asc',
      },
    ]
  }

  function syncUrlState() {
    replaceSaplingTableUrlState(
      {
        search: search.value,
        page: page.value,
        itemsPerPage: itemsPerPage.value,
        defaultItemsPerPage: itemsPerPageDefault.value,
        sortBy: validSortBy.value,
        filter: urlFilter.value,
      },
      Boolean(isUseQueryParameter),
    )
  }

  return {
    activeFilter,
    getRouteState,
    initialSort,
    routeStateSignature,
    syncUrlState,
    tableQuerySignature,
    urlFilter,
    validSortBy,
  }
}
