<template>
  <aside
    v-if="modelValue"
    class="sapling-table-column-chooser"
    role="dialog"
    :aria-label="$t('formConfig.columnSelection')"
    @dragover="onDropZoneDragOver"
    @dragleave="onDropZoneDragLeave"
    @drop="onDrop"
  >
    <v-card class="glass-panel sapling-table-column-chooser__surface" elevation="16">
      <v-card-title class="sapling-table-column-chooser__header">
        <span>{{ $t('formConfig.columnSelection') }}</span>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          :title="$t('global.close')"
          :aria-label="$t('global.close')"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-card-subtitle class="sapling-table-column-chooser__description">
        {{ $t('formConfig.columnSelectionDescription') }}
      </v-card-subtitle>

      <SaplingTextField
        v-model="columnFilter"
        class="sapling-table-column-chooser__filter"
        density="compact"
        variant="outlined"
        prepend-inner-icon="mdi-magnify"
        :label="$t('global.search')"
        :aria-label="$t('global.search')"
        clearable
        hide-details
      />

      <v-card-text
        class="sapling-table-column-chooser__drop-zone"
        :class="{ 'sapling-table-column-chooser__drop-zone--active': isDropTarget }"
      >
        <div class="sapling-table-column-chooser__drop-hint">
          <v-icon size="small">mdi-tray-arrow-down</v-icon>
          <span>{{ $t('formConfig.removeColumnDropHint') }}</span>
        </div>

        <v-list
          v-if="filteredAvailableColumns.length > 0"
          class="sapling-table-column-chooser__list"
          density="compact"
          bg-color="transparent"
          lines="one"
        >
          <v-list-item
            v-for="column in filteredAvailableColumns"
            :key="String(column.key)"
            class="sapling-table-column-chooser__item"
            draggable="true"
            :title="String(column.title ?? column.name ?? column.key)"
            @dragstart="onAvailableColumnDragStart($event, String(column.key))"
            @dragend="isDropTarget = false"
          >
            <template #prepend>
              <v-icon size="small">mdi-drag-vertical</v-icon>
            </template>
            <template #append>
              <v-btn
                icon="mdi-plus"
                size="x-small"
                variant="text"
                :title="$t('formConfig.addColumn')"
                :aria-label="`${$t('formConfig.addColumn')}: ${String(column.title ?? column.key)}`"
                @click="emit('addColumn', String(column.key))"
              />
            </template>
          </v-list-item>
        </v-list>

        <div v-else-if="availableColumns.length === 0" class="sapling-table-column-chooser__empty">
          <v-icon>mdi-check-circle-outline</v-icon>
          <span>{{ $t('formConfig.allColumnsVisible') }}</span>
        </div>

        <div v-else class="sapling-table-column-chooser__empty">
          <v-icon>mdi-magnify-close</v-icon>
          <span>{{ $t('global.notFound') }}</span>
        </div>
      </v-card-text>
    </v-card>
  </aside>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import SaplingTextField from '@/components/common/SaplingTextField.vue'
import type { SaplingTableHeaderItem } from '@/entity/structure'
import { SAPLING_TABLE_COLUMN_DRAG_TYPE } from '@/composables/table/saplingTableColumnOrder'

const props = defineProps<{
  modelValue: boolean
  availableColumns: SaplingTableHeaderItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  addColumn: [columnKey: string]
  removeColumn: [columnKey: string]
}>()

const isDropTarget = ref(false)
const columnFilter = ref('')
const filteredAvailableColumns = computed(() => {
  const query = columnFilter.value.trim().toLocaleLowerCase()
  if (!query) return props.availableColumns

  return props.availableColumns.filter((column) =>
    [column.title, column.name, column.key].some((value) =>
      String(value ?? '')
        .toLocaleLowerCase()
        .includes(query),
    ),
  )
})

watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) columnFilter.value = ''
  },
)

function onAvailableColumnDragStart(event: DragEvent, columnKey: string): void {
  event.dataTransfer?.setData(SAPLING_TABLE_COLUMN_DRAG_TYPE, columnKey)
  event.dataTransfer?.setData('text/plain', columnKey)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDropZoneDragOver(event: DragEvent): void {
  if (!hasColumnDragType(event)) return
  event.preventDefault()
  isDropTarget.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function onDropZoneDragLeave(event: DragEvent): void {
  const target = event.currentTarget as HTMLElement
  if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return
  isDropTarget.value = false
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDropTarget.value = false
  const columnKey =
    event.dataTransfer?.getData(SAPLING_TABLE_COLUMN_DRAG_TYPE) ||
    event.dataTransfer?.getData('text/plain') ||
    ''
  if (columnKey) emit('removeColumn', columnKey)
}

function hasColumnDragType(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes(SAPLING_TABLE_COLUMN_DRAG_TYPE) || types.includes('text/plain')
}
</script>
