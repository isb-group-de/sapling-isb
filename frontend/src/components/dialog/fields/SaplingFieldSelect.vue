<template>
  <div class="sapling-field-select">
    <SaplingFieldTablePicker
      v-model="menuOpen"
      :label="props.label"
      :search-value="fieldSearch"
      @update:search="onActivatorSearchUpdate"
      @surface-mousedown="suppressNextActivatorSearchUpdate"
    >
      <template #activator="{ props: activatorProps, focusFirstResult }">
        <div v-bind="activatorProps" class="sapling-field-select__activator">
          <SaplingAutocomplete
            :disabled="props.disabled"
            :label="props.label"
            :items="autocompleteItems"
            :rules="props.rules"
            :model-value="selectedItems"
            :item-title="getAutocompleteItemTitle"
            :search="fieldSearch"
            :menu="false"
            menu-icon=""
            :density="props.density"
            :hide-details="props.hideDetails"
            return-object
            multiple
            chips
            closable-chips
            clearable
            hide-no-data
            no-filter
            autocomplete="off"
            @keydown.down.prevent="focusFirstResult"
            @focus="openMenu"
            @mousedown:control="openMenu"
            @click:clear="clearSelection"
            @update:menu="closeAutocompleteMenu"
            @update:model-value="onActivatorModelUpdate"
            @update:search="onActivatorSearchUpdate"
          >
            <template #chip="{ props: chipProps, item }">
              <v-chip v-bind="chipProps" class="sapling-field-select__chip">
                <span class="sapling-field-select__selection">
                  <span
                    v-for="line in getAutocompleteItemLines(item)"
                    :key="`${line.isReference}:${line.value}`"
                    class="sapling-field-select__selection-line"
                    :class="{
                      'sapling-field-select__selection-line--reference': line.isReference,
                    }"
                  >
                    {{ line.value }}
                  </span>
                </span>
              </v-chip>
            </template>
            <template #append-inner>
              <v-btn
                class="sapling-field-select__menu-toggle"
                data-testid="toggle-reference-menu"
                icon
                size="small"
                variant="text"
                :disabled="props.disabled"
                :aria-label="props.label"
                :title="props.label"
                @mousedown.stop
                @click.stop="toggleMenu"
              >
                <v-icon>{{ menuOpen ? 'mdi-menu-up' : 'mdi-menu-down' }}</v-icon>
              </v-btn>
            </template>
          </SaplingAutocomplete>
        </div>
      </template>
      <sapling-table
        v-if="menuOpen"
        :entity-handle="entityHandle"
        :items="items"
        :search="search"
        :page="page"
        :items-per-page="itemsPerPage"
        :total-items="totalItems"
        :is-loading="isLoading"
        :is-initialized="isInitialized"
        :sort-by="sortBy"
        :column-filters="columnFilters"
        :active-filter="activeFilter"
        :entity-templates="entityTemplates"
        :entity="entity"
        :entity-permission="entityPermission"
        :show-actions="false"
        :show-search="false"
        :show-toolbar="false"
        :multi-select="true"
        :allow-row-double-click="false"
        :disable-mobile-view="disableDropdownMobileView"
        :table-key="entityHandle"
        :selected="selectedItems"
        @update:page="onPageUpdate"
        @update:items-per-page="onItemsPerPageUpdate"
        @update:sort-by="onSortByUpdate"
        @update:column-filters="onColumnFiltersUpdate"
        @update:search="onSearchUpdate"
        @reload="loadData"
        @update:selected="onTableSelect"
      />
    </SaplingFieldTablePicker>
  </div>
</template>

<script lang="ts" setup>
// #region Imports
import SaplingTable from '@/components/table/SaplingTable.vue'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingFieldTablePicker from '@/components/dialog/fields/SaplingFieldTablePicker.vue'
import type { SaplingGenericItem } from '@/entity/entity'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import { computed, inject, ref, watch } from 'vue'
import { useSaplingSelectField } from '@/composables/fields/useSaplingSelectField'
import { useSaplingEntityValueLabel } from '@/composables/fields/useSaplingEntityValueLabel'
import { useSaplingReferenceFilter } from '@/composables/fields/useSaplingReferenceFilter'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import { saplingTableDisplayContextKey } from '@/components/table/saplingTableDisplayContext'

// #region Props and Emits
const props = withDefaults(
  defineProps<{
    label: string
    entityHandle: string
    modelValue?: SaplingGenericItem[]
    rules?: Array<(v: unknown) => true | string>
    placeholder?: string
    disabled?: boolean
    parentFilter?: FilterQuery
    density?: 'default' | 'comfortable' | 'compact'
    hideDetails?: boolean | 'auto'
  }>(),
  {
    hideDetails: 'auto',
  },
)
const emit = defineEmits(['update:modelValue'])
// #endregion

// #region Composable
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
  parentFilter,
  isInitialized,
  initializeEntityState,
  loadData,
  onSearchUpdate,
  onPageUpdate,
  onItemsPerPageUpdate,
  onColumnFiltersUpdate,
  onSortByUpdate,
} = useSaplingTable(ref(props.entityHandle), DEFAULT_PAGE_SIZE_SMALL, false, false)

const { selectedItems, menuOpen } = useSaplingSelectField(props)
const { getValueLabel, getValueLabelLines } = useSaplingEntityValueLabel(entityTemplates)
const { combineFilters, normalizeFilter, areFiltersEqual } = useSaplingReferenceFilter()
const fieldSearch = ref('')
const autocompleteItems = ref<SaplingGenericItem[]>([])
const genericStore = useGenericStore()
const suppressNextSelectedItemSearch = ref(false)
const placeholderSelectionKey = computed(() => `${props.entityHandle}:${props.placeholder ?? ''}`)
const resolvedPlaceholderSelectionKey = ref<string | null>(
  !props.placeholder || (props.modelValue?.length ?? 0) > 0 ? placeholderSelectionKey.value : null,
)
const tableDisplayContext = inject(saplingTableDisplayContextKey, null)
const disableDropdownMobileView = computed(() => tableDisplayContext?.isMobileTable.value === false)
// #endregion

// #region Selection State
function onTableSelect(newSelected: SaplingGenericItem[]) {
  selectedItems.value = mergeTableSelection(newSelected)
  suppressNextActivatorSearchUpdate()
}

function onActivatorModelUpdate(value: readonly SaplingGenericItem[] | null) {
  const normalizedSelection = normalizeSelectedItems(value)
  if (!areSameItemCollections(normalizedSelection, selectedItems.value)) {
    selectedItems.value = normalizedSelection
  }
}

function onActivatorSearchUpdate(value: string) {
  const nextSearch = value ?? ''

  if (suppressNextSelectedItemSearch.value && nextSearch === '') {
    return
  }

  if (suppressNextSelectedItemSearch.value && isSelectedItemDisplayText(nextSearch)) {
    suppressNextSelectedItemSearch.value = false
    return
  }

  suppressNextSelectedItemSearch.value = false
  fieldSearch.value = nextSearch
  openMenu()

  if (!isInitialized.value) {
    return
  }

  onSearchUpdate(getTableSearchValue())
}

function clearSelection() {
  selectedItems.value = []
  clearSearch()
}

function openMenu() {
  if (!props.disabled) {
    menuOpen.value = true
  }
}

function toggleMenu() {
  if (!props.disabled) {
    menuOpen.value = !menuOpen.value
  }
}

function closeAutocompleteMenu() {
  // The autocomplete is only used as an input surface. Results are rendered by SaplingTable.
}

function suppressNextActivatorSearchUpdate() {
  suppressNextSelectedItemSearch.value = true
}

function clearSearch() {
  if (fieldSearch.value === '' && search.value === '') {
    return
  }

  fieldSearch.value = ''
  if (isInitialized.value) {
    onSearchUpdate('')
  }
}

function getTableSearchValue() {
  return fieldSearch.value
}

function getAutocompleteItemTitle(item: unknown) {
  return getValueLabel(resolveSaplingItem(item))
}

function getAutocompleteItemLines(item: unknown) {
  return getValueLabelLines(resolveSaplingItem(item))
}

function mergeTableSelection(tableSelectedItems: SaplingGenericItem[]) {
  const visibleItemIdentities = new Set(
    items.value.map((item) => getItemIdentity(item)).filter((identity) => identity.length > 0),
  )
  const tableSelectedIdentities = new Set(
    tableSelectedItems
      .map((item) => getItemIdentity(item))
      .filter((identity) => identity.length > 0),
  )
  const nextSelectedItems = selectedItems.value.filter((item) => {
    const identity = getItemIdentity(item)
    return !visibleItemIdentities.has(identity) || tableSelectedIdentities.has(identity)
  })
  const nextSelectedIdentities = new Set(nextSelectedItems.map((item) => getItemIdentity(item)))

  for (const item of tableSelectedItems) {
    const identity = getItemIdentity(item)
    if (!nextSelectedIdentities.has(identity)) {
      nextSelectedItems.push(item)
      nextSelectedIdentities.add(identity)
    }
  }

  return nextSelectedItems
}

function isSelectedItemDisplayText(value: string) {
  if (!value || selectedItems.value.length === 0) {
    return false
  }

  return selectedItems.value.some((item) => value === getAutocompleteItemTitle(item))
}
// #endregion

watch(
  () => props.parentFilter,
  (value) => {
    const nextFilter = normalizeFilter(value)
    if (areFiltersEqual(parentFilter.value, nextFilter)) {
      return
    }

    parentFilter.value = nextFilter
    if (page.value !== 1) {
      page.value = 1
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => [props.entityHandle, selectedItems.value.length, props.placeholder] as const,
  () => {
    if (selectedItems.value.length > 0 || props.placeholder) {
      void ensureEntityMetadataLoaded()
    }
  },
  { immediate: true },
)

watch(menuOpen, async (isOpen) => {
  if (!isOpen) {
    return
  }

  if (!isInitialized.value) {
    await initializeEntityState({ initialSearch: getTableSearchValue() })
    if (!menuOpen.value) {
      return
    }
  }

  const tableSearch = getTableSearchValue()
  if (search.value !== tableSearch) {
    onSearchUpdate(tableSearch)
    return
  }

  await loadData()
})

watch(placeholderSelectionKey, (nextKey) => {
  resolvedPlaceholderSelectionKey.value =
    !props.placeholder || (props.modelValue?.length ?? 0) > 0 ? nextKey : null
})

// #region Lifecycle
watch(
  () => [entityTemplates.value, isLoading.value],
  async ([templates, loading]) => {
    const selectionKey = placeholderSelectionKey.value
    if (
      !loading &&
      templates &&
      props.placeholder &&
      selectedItems.value.length === 0 &&
      resolvedPlaceholderSelectionKey.value !== selectionKey
    ) {
      const entityHandle = props.entityHandle
      const placeholder = props.placeholder
      resolvedPlaceholderSelectionKey.value = selectionKey
      const response = await ApiGenericService.find(entityHandle, {
        filter: combineFilters({ handle: placeholder }, props.parentFilter),
        limit: 1,
      })
      if (
        placeholderSelectionKey.value === selectionKey &&
        selectedItems.value.length === 0 &&
        response.data &&
        response.data.length > 0
      ) {
        selectedItems.value = [response.data[0] as SaplingGenericItem]
      }
    }
  },
  { immediate: true },
)

watch(selectedItems, (val) => {
  const nextValue = val ?? []
  const currentValue = props.modelValue ?? []
  if (!areSameItemCollections(nextValue, currentValue)) {
    emit('update:modelValue', nextValue)
  }
})
// #endregion

function areSameItemCollections(left: Record<string, unknown>[], right: Record<string, unknown>[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => getItemIdentity(item) === getItemIdentity(right[index]))
}

function getItemIdentity(item?: Record<string, unknown>) {
  if (!item || typeof item !== 'object') {
    return ''
  }

  const handle = item.handle
  if (typeof handle === 'string' || typeof handle === 'number') {
    return `handle:${String(handle)}`
  }

  return JSON.stringify(item)
}

function normalizeSelectedItems(value: readonly SaplingGenericItem[] | null | undefined) {
  return (value ?? [])
    .map((item) => resolveSaplingItem(item))
    .filter((item): item is SaplingGenericItem => item !== null)
}

function resolveSaplingItem(item: unknown): SaplingGenericItem | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  if ('raw' in item && item.raw && typeof item.raw === 'object') {
    return item.raw as SaplingGenericItem
  }

  return item as SaplingGenericItem
}

async function ensureEntityMetadataLoaded() {
  if (!props.entityHandle || entityTemplates.value.length > 0) {
    return
  }

  await genericStore.loadGeneric(props.entityHandle, 'global', 'filter', 'exception')
}
</script>
