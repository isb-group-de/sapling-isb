<template>
  <SaplingTable
    class="sapling-widget-table"
    :items="items"
    :entity-handle="entityHandle"
    :entity="entity"
    :entity-permission="entityPermission"
    :entity-templates="entityTemplates"
    :search="search"
    :page="page"
    :items-per-page="itemsPerPage"
    :total-items="totalItems"
    :is-loading="isLoading"
    :sort-by="sortBy"
    :headers="widgetHeaders"
    :table-key="widget.id"
    :active-filter="activeFilter"
    :parent-filter="parentFilter"
    :column-filters="columnFilters"
    :is-initialized="isInitialized"
    :show-actions="true"
    :show-favorite="false"
    :show-form-config="false"
    :sync-edit-dialog-with-route="false"
    :enable-tutorial="false"
    @update:search="onSearchUpdate"
    @update:page="onPageUpdate"
    @update:items-per-page="onItemsPerPageUpdate"
    @update:sort-by="onSortByUpdate"
    @update:column-filters="onColumnFiltersUpdate"
    @reload="loadData"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSupportedTableHeaders } from '@/utils/saplingTableTemplateUtil'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'
import SaplingTable from '@/components/table/SaplingTable.vue'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
const props = defineProps<{ widget: Extract<DashboardWidget, { kind: 'TABLE' }> }>()
const { t } = useI18n()
const permissions = useCurrentPermissionStore()
const entityHandle = computed(() => props.widget.config.entity)
const table = useSaplingTable(
  entityHandle,
  props.widget.config.pageSize,
  false,
  true,
  () => ({
    initialSearch: props.widget.config.search,
    beforeInitialLoad: () => {
      table.parentFilter.value = JSON.parse(JSON.stringify(props.widget.config.filter))
      table.sortBy.value = [...props.widget.config.sortBy]
      table.onVisibleColumnKeysUpdate(props.widget.config.columns)
    },
  }),
  [],
  { applyDefaultOpenChipFilters: false },
)
const {
  items,
  entity,
  entityPermission,
  entityTemplates,
  search,
  page,
  itemsPerPage,
  totalItems,
  isLoading,
  sortBy,
  headers,
  activeFilter,
  parentFilter,
  columnFilters,
  isInitialized,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onSortByUpdate,
  onColumnFiltersUpdate,
  loadData,
} = table
const widgetHeaders = computed(() =>
  props.widget.config.columns.length
    ? props.widget.config.columns.flatMap((key) =>
        getSupportedTableHeaders(
          entityTemplates.value,
          entity.value,
          t,
          permissions.accumulatedPermission ?? [],
        ).filter((header) => header.key === key),
      )
    : headers.value,
)
defineExpose({ refresh: loadData })
</script>
