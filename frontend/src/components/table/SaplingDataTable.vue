<template>
  <SaplingTableSurface>
    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.key"
          scope="col"
          class="sapling-table-header-cell"
          :class="`text-${column.align ?? 'start'}`"
          :aria-sort="
            column.sortable === false
              ? undefined
              : sortKey === column.key
                ? direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
          "
        >
          <div class="sapling-data-table__heading">
            <button
              v-if="column.sortable !== false"
              type="button"
              class="sapling-data-table__sort"
              :aria-label="column.title"
              @click="toggleSort(column.key)"
            >
              <span>{{ column.title }}</span>
              <v-icon
                size="16"
                :icon="
                  sortKey === column.key
                    ? direction === 'asc'
                      ? 'mdi-arrow-up'
                      : 'mdi-arrow-down'
                    : 'mdi-swap-vertical'
                "
              />
            </button>
            <span v-else>{{ column.title }}</span>
            <slot :name="`header.${column.key}`" :column="column" />
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      <template
        v-for="(item, index) in sortedItems"
        :key="itemKey ? itemKey(item) : items.indexOf(item)"
      >
        <slot name="row" :item="item" :index="index">
          <tr>
            <td
              v-for="column in columns"
              :key="column.key"
              :class="`text-${column.align ?? 'start'}`"
            >
              {{ column.value?.(item) ?? '' }}
            </td>
          </tr>
        </slot>
      </template>
      <tr v-if="!items.length">
        <td :colspan="columns.length" class="sapling-data-table__empty">
          {{ emptyText || $t('global.noData') }}
        </td>
      </tr>
    </tbody>
  </SaplingTableSurface>
</template>

<script setup lang="ts" generic="T">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SaplingTableSurface from './SaplingTableSurface.vue'
import { sortDataRows, type SaplingDataColumn } from './saplingDataTable.types'

const props = defineProps<{
  items: readonly T[]
  columns: readonly SaplingDataColumn<T>[]
  itemKey?: (item: T) => string | number
  emptyText?: string
}>()
const { locale } = useI18n()
const sortKey = ref<string | null>(null)
const direction = ref<'asc' | 'desc'>('asc')
const sortedItems = computed(() => {
  const column = props.columns.find((candidate) => candidate.key === sortKey.value)
  return column?.value && column.sortable !== false
    ? sortDataRows(props.items, column.value, direction.value, locale.value)
    : props.items
})

function toggleSort(key: string) {
  if (sortKey.value !== key) {
    sortKey.value = key
    direction.value = 'asc'
  } else if (direction.value === 'asc') {
    direction.value = 'desc'
  } else {
    sortKey.value = null
  }
}
</script>
