<template>
  <SaplingTable
    enable-tutorial
    :key="entityHandle"
    :entity-handle="entityHandle"
    :items="items"
    :search="search"
    :page="page"
    :items-per-page="itemsPerPage"
    :total-items="totalItems"
    :is-loading="isLoading"
    :sort-by="sortBy"
    :column-filters="columnFilters"
    :active-filter="activeFilter"
    :entity-templates="entityTemplates"
    :entity="entity"
    :entity-permission="entityPermission"
    :is-initialized="isInitialized"
    :form-config-menu-items="formConfigMenuItems"
    :selected-form-config-label="selectedFormConfigLabel"
    :is-loading-form-configs="isLoadingFormConfigs"
    :is-saving-table-view="isSavingTableView"
    :open-edit-handle="openEditHandle"
    sync-edit-dialog-with-route
    :show-actions="true"
    :multi-select="true"
    :show-favorite="true"
    :show-add="true"
    :table-key="entityHandle"
    @update:page="onPageUpdate"
    @update:items-per-page="onItemsPerPageUpdate"
    @update:sort-by="onSortByUpdate"
    @update:column-filters="onColumnFiltersUpdate"
    @update:search="onSearchUpdate"
    @select-form-config="selectFormConfig"
    @set-default-form-config="setDefaultFormConfig"
    @delete-form-config="deleteFormConfig"
    @save-current-view="saveCurrentView"
    @update:visible-column-keys="onVisibleColumnKeysUpdate"
    @reload="loadData"
  />
</template>

<script lang="ts" setup>
import { computed, toRef } from 'vue'
import { useRoute } from 'vue-router'
import SaplingTable from '@/components/table/SaplingTable.vue'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import { DEFAULT_PAGE_SIZE_MEDIUM } from '@/constants/project.constants'

const props = defineProps<{
  entityHandle: string
}>()

const entityHandle = toRef(props, 'entityHandle')
const route = useRoute()
const openEditHandle = computed(() => {
  const value = Array.isArray(route.query.open) ? route.query.open[0] : route.query.open
  return typeof value === 'string' && value.trim().length > 0 ? value : null
})

const {
  items,
  search,
  page,
  itemsPerPage,
  totalItems,
  isLoading,
  sortBy,
  columnFilters,
  activeFilter,
  entityTemplates,
  entity,
  entityPermission,
  isInitialized,
  formConfigMenuItems,
  selectedFormConfigLabel,
  isLoadingFormConfigs,
  isSavingTableView,
  loadData,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onColumnFiltersUpdate,
  onSortByUpdate,
  onVisibleColumnKeysUpdate,
  selectFormConfig,
  setDefaultFormConfig,
  deletePersonalFormConfig,
  savePersonalTableView,
} = useSaplingTable(entityHandle, DEFAULT_PAGE_SIZE_MEDIUM, true)

async function saveCurrentView(request: {
  name: string
  orderedColumnKeys: string[]
  selectableColumnKeys: string[]
  complete: (saved: boolean) => void
}): Promise<void> {
  try {
    await savePersonalTableView(
      request.name,
      request.orderedColumnKeys,
      request.selectableColumnKeys,
    )
    request.complete(true)
  } catch {
    request.complete(false)
  }
}

async function deleteFormConfig(request: {
  handle: number
  complete: (deleted: boolean) => void
}): Promise<void> {
  try {
    await deletePersonalFormConfig(request.handle)
    request.complete(true)
  } catch {
    request.complete(false)
  }
}
</script>
