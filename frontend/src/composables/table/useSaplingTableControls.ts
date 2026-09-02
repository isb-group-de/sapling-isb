import type { Ref } from 'vue'
import type { ColumnFilterItem, SortItem } from '@/entity/structure'
import type { useSaplingTableFormConfig } from './useSaplingTableFormConfig'
import { GENERIC_API_MAX_PAGE_SIZE } from '@/constants/project.constants'

export function useSaplingTableControls(options: {
  search: Ref<string>
  page: Ref<number>
  itemsPerPage: Ref<number>
  sortBy: Ref<SortItem[]>
  columnFilters: Ref<Record<string, ColumnFilterItem>>
  temporaryVisibleColumnKeys: Ref<string[]>
  isResettingEntityState: Ref<boolean>
  formConfigContext: ReturnType<typeof useSaplingTableFormConfig>
}) {
  const {
    search,
    page,
    itemsPerPage,
    sortBy,
    columnFilters,
    temporaryVisibleColumnKeys,
    isResettingEntityState,
    formConfigContext,
  } = options
  const { setPersonalDefault, deletePersonalTableView } = formConfigContext

  function onSearchUpdate(value: string) {
    if (isResettingEntityState.value) {
      return
    }

    search.value = value
    page.value = 1
  }

  function onPageUpdate(value: number) {
    if (isResettingEntityState.value) {
      return
    }

    page.value = value
  }

  function onItemsPerPageUpdate(value: number) {
    if (isResettingEntityState.value) {
      return
    }

    itemsPerPage.value = Math.min(Math.max(value, 1), GENERIC_API_MAX_PAGE_SIZE)
    page.value = 1
  }

  function onColumnFiltersUpdate(value: Record<string, ColumnFilterItem>) {
    if (isResettingEntityState.value) {
      return
    }

    columnFilters.value = { ...value }
    page.value = 1
  }

  function onSortByUpdate(value: SortItem[]) {
    if (isResettingEntityState.value) {
      return
    }

    sortBy.value = value
  }

  function onVisibleColumnKeysUpdate(value: string[]) {
    temporaryVisibleColumnKeys.value = [...new Set(value.filter(Boolean))]
  }

  function selectFormConfig(handle: number | null): void {
    temporaryVisibleColumnKeys.value = []
    formConfigContext.select(handle)
  }

  async function setDefaultFormConfig(handle: number): Promise<void> {
    temporaryVisibleColumnKeys.value = []
    await setPersonalDefault(handle)
  }

  async function savePersonalTableView(
    name: string,
    orderedColumnKeys: string[],
    selectableColumnKeys: string[],
  ) {
    const savedConfig = await formConfigContext.savePersonalTableView(
      name,
      orderedColumnKeys,
      selectableColumnKeys,
    )
    temporaryVisibleColumnKeys.value = []
    return savedConfig
  }
  async function deletePersonalFormConfig(handle: number): Promise<void> {
    temporaryVisibleColumnKeys.value = []
    await deletePersonalTableView(handle)
  }

  return {
    deletePersonalFormConfig,
    onColumnFiltersUpdate,
    onItemsPerPageUpdate,
    onPageUpdate,
    onSearchUpdate,
    onSortByUpdate,
    onVisibleColumnKeysUpdate,
    savePersonalTableView,
    selectFormConfig,
    setDefaultFormConfig,
  }
}
