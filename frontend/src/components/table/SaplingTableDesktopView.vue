<template>
  <v-data-table-server
    data-tutorial="table-data"
    :key="tableKey"
    density="compact"
    fixed-header
    height="100%"
    class="sapling-table"
    :headers="visibleHeaders"
    :items="items"
    :item-value="getItemValue"
    :page="page"
    :items-per-page="itemsPerPage"
    :items-per-page-options="DEFAULT_PAGE_SIZE_OPTIONS"
    :items-length="totalItems"
    :server-items-length="totalItems"
    :sort-by="sortBy"
    @update:page="emit('update:page', $event)"
    @update:items-per-page="emit('update:items-per-page', $event)"
    @update:sort-by="emit('update:sort-by', $event)"
  >
    <template #headers="{ columns, isSorted, getSortIcon, toggleSort }">
      <tr data-tutorial="table-filter-row">
        <template v-for="column in columns" :key="String(column.key ?? column.title ?? '')">
          <th
            :class="getHeaderCellClasses(column)"
            :draggable="columnOrderEditing && isDataColumn(column)"
            @dragstart="onColumnDragStart($event, column)"
            @dragend="clearColumnDrag"
            @dragover="onColumnDragOver($event, column)"
            @dragleave="onColumnDragLeave($event, column)"
            @drop="onColumnDrop($event, column)"
          >
            <template v-if="column.key === '__actions'">
              <span></span>
            </template>
            <template v-else-if="column.key === '__select'">
              <v-checkbox
                data-testid="table-page-selection"
                class="sapling-table-header-selection-checkbox"
                :model-value="allRowsSelected"
                :indeterminate="someRowsSelected"
                hide-details
                density="compact"
                :aria-label="pageSelectionLabel"
                :title="pageSelectionLabel"
                @update:model-value="togglePageSelection"
                @click.stop
              />
            </template>
            <template v-else-if="isDesktopColumnFilterable(column)">
              <div class="sapling-table-filter-shell">
                <button
                  v-if="columnOrderEditing"
                  class="sapling-table-column-drag-handle"
                  type="button"
                  draggable="true"
                  :title="getColumnMoveLabel(column)"
                  :aria-label="getColumnMoveLabel(column)"
                  @keydown="onColumnHandleKeydown($event, column)"
                >
                  <v-icon size="x-small">mdi-drag-vertical</v-icon>
                </button>
                <SaplingTableColumnFilter
                  :column="column"
                  :filter-item="getColumnFilterItem(String(column.key ?? ''))"
                  :title="String(column.title ?? '')"
                  :loading="isHeaderTranslationLoading"
                  :operator-options="getDesktopFilterOperatorOptions(column)"
                  :sort-icon="isSorted(column) ? getSortIcon(column) : 'mdi-swap-vertical'"
                  @update:filter="
                    (value) =>
                      emit('update:column-filter', {
                        key: String(column.key ?? ''),
                        value,
                      })
                  "
                  @sort="toggleSort(column)"
                />
              </div>
            </template>
            <template v-else>
              <div class="sapling-table-header-content">
                <button
                  v-if="columnOrderEditing"
                  class="sapling-table-column-drag-handle"
                  type="button"
                  draggable="true"
                  :title="getColumnMoveLabel(column)"
                  :aria-label="getColumnMoveLabel(column)"
                  @keydown="onColumnHandleKeydown($event, column)"
                >
                  <v-icon size="x-small">mdi-drag-vertical</v-icon>
                </button>
                <button
                  class="sapling-table-header-button"
                  type="button"
                  @click="toggleSort(column)"
                >
                  <span v-if="!isHeaderTranslationLoading">{{ column.title }}</span>
                  <v-skeleton-loader
                    v-else
                    class="sapling-table-header-skeleton"
                    type="text"
                    width="88"
                  />
                  <v-icon v-if="isSorted(column)" size="small">{{ getSortIcon(column) }}</v-icon>
                </button>
              </div>
            </template>
          </th>
        </template>
      </tr>
      <tr class="sapling-table-loading-row" aria-hidden="true">
        <th :colspan="columns.length">
          <v-progress-linear
            class="sapling-table-loading-progress"
            :active="isLoading"
            color="primary"
            height="2"
            :indeterminate="isLoading"
          />
        </th>
      </tr>
    </template>

    <template #item="{ item, index }">
      <SaplingTableRow
        v-memo="[
          item.handle,
          item.updatedAt,
          isRowSelected(index),
          multiSelect,
          showActions,
          visibleHeaders,
        ]"
        :item="item"
        :columns="visibleHeaders"
        :index="index"
        :is-selected="isRowSelected(index)"
        :multi-select="multiSelect"
        :entity="entity"
        :entity-permission="entityPermission"
        :entity-templates="entityTemplates"
        :entity-handle="entityHandle"
        :script-buttons="rowScriptButtons"
        :can-navigate="canNavigate"
        :can-show-information="canShowInformation"
        :show-actions="showActions"
        :row-interaction="rowInteraction"
        @select-row="emit('select-row', $event)"
        @change-log="emit('change-log', $event)"
        @delete="emit('delete', $event)"
        @edit="emit('edit', $event)"
        @show="emit('show', $event)"
        @copy="emit('copy', $event)"
        @script="emit('script', $event)"
        @navigate="emit('navigate', $event)"
        @timeline="emit('timeline', $event)"
        @upload-document="emit('upload-document', $event)"
        @show-documents="emit('show-documents', $event)"
        @show-information="emit('show-information', $event)"
        @show-external-record-links="emit('show-external-record-links', $event)"
        @open-context-menu="emit('open-context-menu', $event)"
        @reload="emit('reload')"
      />
    </template>
  </v-data-table-server>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_PAGE_SIZE_OPTIONS } from '@/constants/project.constants'
import type { EntityItem, SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import type {
  AccumulatedPermission,
  ColumnFilterItem,
  ColumnFilterOperator,
  EntityTemplate,
  SaplingTableHeaderItem,
  SortItem,
} from '@/entity/structure'
import type {
  SaplingTableRowContextMenuOpenPayload,
  UseSaplingTableRowEmit,
} from '@/composables/table/useSaplingTableRow'
import SaplingTableColumnFilter from './filter/SaplingTableColumnFilter.vue'
import {
  SAPLING_TABLE_COLUMN_DRAG_TYPE,
  type SaplingTableColumnMove,
  type SaplingTableColumnPlacement,
} from '@/composables/table/saplingTableColumnOrder'

type FilterOperatorOption = { label: string; value: ColumnFilterOperator }
type TableColumnLike = Record<string, unknown> & { key?: string | null; title?: string | null }

type SaplingTableDesktopViewEmit = UseSaplingTableRowEmit & {
  (event: 'open-context-menu', value: SaplingTableRowContextMenuOpenPayload): void
  (event: 'update:page', value: number): void
  (event: 'update:items-per-page', value: number | string): void
  (event: 'update:sort-by', value: SortItem[]): void
  (event: 'update:column-filter', value: { key: string; value: ColumnFilterItem | null }): void
  (event: 'move-column', value: SaplingTableColumnMove): void
  (event: 'remove-column', value: string): void
  (event: 'select-all-rows'): void
  (event: 'clear-selection'): void
}

const SaplingTableRow = defineAsyncComponent(() => import('./SaplingTableRow.vue'))

const props = defineProps<{
  tableKey: string
  items: SaplingGenericItem[]
  totalItems: number
  itemsPerPage: number
  page: number
  isLoading: boolean
  sortBy: SortItem[]
  visibleHeaders: SaplingTableHeaderItem[]
  multiSelect?: boolean
  entity: EntityItem | null
  entityPermission: AccumulatedPermission | null
  entityTemplates: EntityTemplate[]
  entityHandle: string
  rowScriptButtons: ScriptButtonItem[]
  canNavigate: boolean
  canShowInformation: boolean
  showActions: boolean
  rowInteraction?: boolean
  selectedRows: number[]
  selectedRow: number | null
  isHeaderTranslationLoading: boolean
  columnOrderEditing: boolean
  getColumnFilterItem: (columnKey: string) => ColumnFilterItem | null | undefined
  getFilterOperatorOptions: (column: SaplingTableHeaderItem) => FilterOperatorOption[]
  isColumnFilterable: (column: SaplingTableHeaderItem) => boolean
}>()

const emit = defineEmits<SaplingTableDesktopViewEmit>()
const { t } = useI18n()
const draggedColumnKey = ref<string | null>(null)
const dragTarget = ref<{ key: string; placement: SaplingTableColumnPlacement } | null>(null)
let dragPreviewElement: HTMLElement | null = null

const allRowsSelected = computed(
  () =>
    Boolean(props.multiSelect) &&
    props.items.length > 0 &&
    props.selectedRows.length === props.items.length,
)
const someRowsSelected = computed(
  () => Boolean(props.multiSelect) && props.selectedRows.length > 0 && !allRowsSelected.value,
)
const pageSelectionLabel = computed(() =>
  allRowsSelected.value ? t('global.clearSelection') : t('global.selectAll'),
)

function togglePageSelection(selected: boolean | null): void {
  if (selected) {
    emit('select-all-rows')
    return
  }

  emit('clear-selection')
}

function getHeaderCellClasses(column: Record<string, unknown> & { key?: string | null }) {
  const key = String(column.key ?? '')

  return [
    'sapling-table-header-cell',
    key === '__select' ? 'sapling-table-header-cell--select' : '',
    key === '__actions' ? 'sapling-table-header-cell--actions' : '',
    key !== '__select' && key !== '__actions' ? 'sapling-table-header-cell--data' : '',
    draggedColumnKey.value === key ? 'sapling-table-header-cell--dragging' : '',
    dragTarget.value?.key === key && dragTarget.value.placement === 'before'
      ? 'sapling-table-header-cell--drop-before'
      : '',
    dragTarget.value?.key === key && dragTarget.value.placement === 'after'
      ? 'sapling-table-header-cell--drop-after'
      : '',
  ].filter(Boolean)
}

function isDataColumn(column: TableColumnLike): boolean {
  const key = String(column.key ?? '')
  return Boolean(key) && !['__select', '__actions'].includes(key)
}

function getColumnMoveLabel(column: TableColumnLike): string {
  return `${t('formConfig.moveColumn')}: ${String(column.title ?? '')}`
}

function onColumnDragStart(event: DragEvent, column: TableColumnLike): void {
  if (!props.columnOrderEditing || !isDataColumn(column)) return

  const key = String(column.key)
  draggedColumnKey.value = key
  event.dataTransfer?.setData(SAPLING_TABLE_COLUMN_DRAG_TYPE, key)
  event.dataTransfer?.setData('text/plain', key)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    const headerCell = event.currentTarget as HTMLElement
    const headerRect = headerCell.getBoundingClientRect()
    dragPreviewElement?.remove()
    dragPreviewElement = document.createElement('div')
    dragPreviewElement.className = 'sapling-table-column-drag-preview'
    dragPreviewElement.setAttribute('aria-hidden', 'true')
    dragPreviewElement.style.width = `${headerRect.width}px`
    dragPreviewElement.style.height = `${headerRect.height}px`
    dragPreviewElement.innerHTML = headerCell.innerHTML
    document.body.appendChild(dragPreviewElement)
    event.dataTransfer.setDragImage(
      dragPreviewElement,
      Math.max(0, Math.min(event.clientX - headerRect.left, headerRect.width)),
      Math.max(0, Math.min(event.clientY - headerRect.top, headerRect.height)),
    )
  }
}

function onColumnDragOver(event: DragEvent, column: TableColumnLike): void {
  if (!props.columnOrderEditing || !hasColumnDragType(event) || !isDataColumn(column)) return

  const targetKey = String(column.key)
  const sourceKey = getDraggedColumnKey(event)
  if (targetKey === sourceKey) {
    dragTarget.value = null
    return
  }

  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const target = event.currentTarget as HTMLElement
  dragTarget.value = {
    key: targetKey,
    placement:
      event.clientX < target.getBoundingClientRect().left + target.offsetWidth / 2
        ? 'before'
        : 'after',
  }
}

function onColumnDragLeave(event: DragEvent, column: TableColumnLike): void {
  if (dragTarget.value?.key !== String(column.key ?? '')) return
  const target = event.currentTarget as HTMLElement
  if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return
  dragTarget.value = null
}

function onColumnDrop(event: DragEvent, column: TableColumnLike): void {
  event.preventDefault()
  const sourceKey = getDraggedColumnKey(event)
  const targetKey = String(column.key ?? '')
  const placement = dragTarget.value?.key === targetKey ? dragTarget.value.placement : 'before'
  clearColumnDrag()

  if (
    !props.columnOrderEditing ||
    !sourceKey ||
    !targetKey ||
    sourceKey === targetKey ||
    !isDataColumn(column)
  )
    return
  emit('move-column', { sourceKey, targetKey, placement })
}

function moveColumnByStep(column: TableColumnLike, direction: -1 | 1): void {
  const sourceKey = String(column.key ?? '')
  const dataColumns = props.visibleHeaders.filter(isDataColumn)
  const sourceIndex = dataColumns.findIndex((item) => String(item.key) === sourceKey)
  const target = dataColumns[sourceIndex + direction]
  if (!target) return

  emit('move-column', {
    sourceKey,
    targetKey: String(target.key),
    placement: direction < 0 ? 'before' : 'after',
  })
}

function onColumnHandleKeydown(event: KeyboardEvent, column: TableColumnLike): void {
  if (props.columnOrderEditing && ['Delete', 'Backspace'].includes(event.key)) {
    event.preventDefault()
    emit('remove-column', String(column.key ?? ''))
    return
  }

  if (
    !props.columnOrderEditing ||
    !event.altKey ||
    !['ArrowLeft', 'ArrowRight'].includes(event.key)
  )
    return

  event.preventDefault()
  moveColumnByStep(column, event.key === 'ArrowLeft' ? -1 : 1)
}

function getDraggedColumnKey(event: DragEvent): string {
  return (
    draggedColumnKey.value ||
    event.dataTransfer?.getData(SAPLING_TABLE_COLUMN_DRAG_TYPE) ||
    event.dataTransfer?.getData('text/plain') ||
    ''
  )
}

function hasColumnDragType(event: DragEvent): boolean {
  if (draggedColumnKey.value) return true
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes(SAPLING_TABLE_COLUMN_DRAG_TYPE) || types.includes('text/plain')
}

function clearColumnDrag(): void {
  dragPreviewElement?.remove()
  dragPreviewElement = null
  draggedColumnKey.value = null
  dragTarget.value = null
}

function isRowSelected(index: number) {
  return props.multiSelect ? props.selectedRows.includes(index) : props.selectedRow === index
}

function getItemValue(item: SaplingGenericItem): string | number {
  const handle = item?.handle
  return typeof handle === 'string' || typeof handle === 'number' ? handle : ''
}

function isDesktopColumnFilterable(column: TableColumnLike) {
  return props.isColumnFilterable(column as SaplingTableHeaderItem)
}

function getDesktopFilterOperatorOptions(column: TableColumnLike) {
  return props.getFilterOperatorOptions(column as SaplingTableHeaderItem)
}
</script>
