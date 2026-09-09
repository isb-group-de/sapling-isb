<template>
  <div
    class="sapling-field-single-select"
    :class="{
      'sapling-field-single-select--with-open-action': props.showOpenAction,
      'sapling-field-single-select--with-help-slot': props.reserveHelpSpace || props.helpText,
      'sapling-field-single-select--multiline': reservesMultilineSelection,
    }"
  >
    <SaplingFieldTablePicker
      v-model="menuOpen"
      :label="props.label"
      :search-value="fieldSearch"
      @update:search="onActivatorSearchUpdate"
    >
      <template #activator="{ props: activatorProps, focusFirstResult }">
        <div
          v-bind="activatorProps"
          class="sapling-field-select__activator"
          @input.capture="onAutocompleteInput"
        >
          <SaplingAutocomplete
            :disabled="props.disabled"
            :label="props.label"
            :items="autocompleteItems"
            :rules="props.rules"
            :model-value="displayedSelectedItem"
            :item-title="getAutocompleteItemTitle"
            :search="fieldSearch"
            :menu="false"
            :density="props.density"
            :hide-details="props.hideDetails"
            return-object
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
            @update:focused="isAutocompleteFocused = $event"
            @update:search="onAutocompleteSearchUpdate"
          >
            <template #selection="{ item }">
              <span class="sapling-field-single-select__selection">
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
        :multi-select="false"
        :allow-row-double-click="false"
        :disable-mobile-view="disableDropdownMobileView"
        :table-key="entityHandle"
        :selected="selectedItem ? [selectedItem] : []"
        @update:page="onPageUpdate"
        @update:items-per-page="onItemsPerPageUpdate"
        @update:sort-by="onSortByUpdate"
        @update:column-filters="onColumnFiltersUpdate"
        @update:search="onSearchUpdate"
        @reload="loadData"
        @update:selected="onTableSelect"
      />
    </SaplingFieldTablePicker>

    <div
      v-if="props.reserveHelpSpace || props.helpText"
      class="sapling-field-single-select__help-slot"
      data-test="reference-help-slot"
    >
      <SaplingHelpTooltip
        v-if="props.helpText"
        :text="props.helpText"
        :aria-label="props.helpAriaLabel || props.label"
        icon-size="16"
        compact
      />
    </div>

    <v-tooltip v-if="props.showOpenAction" location="top" :text="openActionLabel">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          class="sapling-button--icon sapling-field-action-button sapling-field-single-select__open-action"
          data-test="open-reference-record"
          :icon="isCreateAction ? 'mdi-plus' : 'mdi-open-in-new'"
          variant="tonal"
          size="small"
          :aria-label="openActionLabel"
          :disabled="!canOpenSelectedRecord"
          :loading="isRecordDialogLoading"
          @mousedown.stop
          @click.stop="openSelectedRecord"
        />
      </template>
    </v-tooltip>
  </div>

  <SaplingDialogEdit
    v-if="recordDialogOpen && recordDialogItem && entity"
    :model-value="recordDialogOpen"
    :mode="recordDialogMode"
    :item="recordDialogItem"
    :entity="entity"
    :templates="entityTemplates"
    :show-reference="true"
    @update:model-value="handleRecordDialogVisibility"
    @update:item="recordDialogItem = $event"
    @save="saveRecordDialog"
    @deleted="handleRecordDeleted"
  />
</template>

<script lang="ts" setup>
// #region Imports
import SaplingTable from '@/components/table/SaplingTable.vue'
import SaplingAutocomplete from '@/components/common/SaplingAutocomplete.vue'
import SaplingFieldTablePicker from '@/components/dialog/fields/SaplingFieldTablePicker.vue'
import SaplingHelpTooltip from '@/components/common/SaplingHelpTooltip.vue'
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import type { SaplingGenericItem } from '@/entity/entity'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import { computed, inject, ref, watch } from 'vue'
import { useSaplingSingleSelectField } from '@/composables/fields/useSaplingSingleSelectField'
import { useSaplingEntityValueLabel } from '@/composables/fields/useSaplingEntityValueLabel'
import { useSaplingReferenceFilter } from '@/composables/fields/useSaplingReferenceFilter'
import { useSaplingReferenceRecordDialog } from '@/composables/fields/useSaplingReferenceRecordDialog'
import { getDialogRecordRelations } from '@/composables/dialog/saplingDialogRecordLoader'
import { getItemHandle } from '@/composables/table/saplingTableAction.utils'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import ApiGenericService from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { saplingTableDisplayContextKey } from '@/components/table/saplingTableDisplayContext'
import {
  hasIncompleteValueData,
  resolveSaplingItem,
  type SaplingFieldSingleSelectProps,
} from './saplingFieldSingleSelect.utils'
// #endregion

// #region Props and Emits
const props = withDefaults(defineProps<SaplingFieldSingleSelectProps>(), {
  hideDetails: 'auto',
  showOpenAction: false,
  openActionLabel: '',
  helpText: '',
  helpAriaLabel: '',
  reserveHelpSpace: false,
})
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
} = useSaplingTable(ref(props.entityHandle), DEFAULT_PAGE_SIZE_SMALL, false, false, () => ({}), [
  ...(props.dependencyTargetField ? [props.dependencyTargetField] : []),
  ...(props.additionalListProjectionFields ?? []),
])

const { selectedItem, menuOpen } = useSaplingSingleSelectField(props)
const { getValueLabel, getValueLabelLines } = useSaplingEntityValueLabel(entityTemplates)
const { combineFilters, normalizeFilter, areFiltersEqual } = useSaplingReferenceFilter()
const fieldSearch = ref('')
const isAutocompleteFocused = ref(false)
const autocompleteItems = ref<SaplingGenericItem[]>([])
const genericStore = useGenericStore()
const tableDisplayContext = inject(saplingTableDisplayContextKey, null)
const disableDropdownMobileView = computed(() => tableDisplayContext?.isMobileTable.value === false)
const hydratedSelectedItem = ref<SaplingGenericItem | null>(null)
let selectedItemHydrationRequestId = 0
const placeholderSelectionKey = computed(() => `${props.entityHandle}:${props.placeholder ?? ''}`)
const resolvedPlaceholderSelectionKey = ref<string | null>(
  !props.placeholder || props.modelValue ? placeholderSelectionKey.value : null,
)
const displayedSelectedItem = computed(() =>
  hydratedSelectedItem.value &&
  getItemHandle(hydratedSelectedItem.value) === getItemHandle(selectedItem.value)
    ? hydratedSelectedItem.value
    : selectedItem.value,
)
const hasMultilineSelection = computed(
  () => getValueLabelLines(displayedSelectedItem.value).length > 1,
)
const reservesMultilineSelection = computed(() => {
  const valueTemplates = entityTemplates.value.filter((template) =>
    template.options?.includes('isValue'),
  )
  const scalarLineCount = valueTemplates.some((template) => !template.isReference) ? 1 : 0
  const referenceLineCount = valueTemplates.filter((template) => template.isReference).length

  // Scalar value fields share the first line, while every value reference is
  // rendered on its own line. Reserve that geometry before a value is chosen
  // so clearing or selecting a record never changes the control height.
  return scalarLineCount + referenceLineCount > 1 || hasMultilineSelection.value
})
const {
  recordDialogOpen,
  recordDialogItem,
  recordDialogMode,
  isRecordDialogLoading,
  isCreateAction,
  openActionLabel,
  canOpenSelectedRecord,
  openSelectedRecord,
  handleRecordDialogVisibility,
  saveRecordDialog,
  handleRecordDeleted,
} = useSaplingReferenceRecordDialog({
  props,
  selectedItem,
  menuOpen,
  entity,
  entityPermission,
  entityTemplates,
  ensureEntityMetadataLoaded,
  clearSelection,
})
// #endregion

// #region Selection State
let selectionRequest = 0
async function onTableSelect(newSelected: SaplingGenericItem[]) {
  const request = ++selectionRequest
  let nextItem = newSelected[0] ?? null
  menuOpen.value = false
  if (nextItem && props.additionalListProjectionFields?.length) {
    // Picker rows are projections. Load readable context before suggesting it
    // to the parent form, so hidden table columns do not lose their values.
    const handle = getItemHandle(nextItem)
    if (handle != null) {
      try {
        const response = await ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
          filter: { handle },
          limit: 1,
          relations: getDialogRecordRelations(entityTemplates.value),
        })
        nextItem = response.data[0] ?? null
      } catch {
        return
      }
    }
  }
  if (request !== selectionRequest || props.disabled) return
  selectedItem.value = nextItem
  clearSearch()
}

function onActivatorModelUpdate(value: SaplingGenericItem | null) {
  if (value == null) {
    clearSelection()
    return
  }

  const resolvedItem = resolveSaplingItem(value)
  if (resolvedItem) {
    selectedItem.value = resolvedItem
  }
}

function onAutocompleteSearchUpdate(value: string) {
  // Vuetify replaces search with the selection label on blur. Moving to the
  // result table (pagination, filters or keyboard navigation) is not a new query.
  if (isAutocompleteFocused.value) onActivatorSearchUpdate(value)
}

function onAutocompleteInput(event: Event) {
  // After an ignored blur reset, Vuetify can suppress an identical next search
  // update (notably deleting all text). Native input still represents that edit.
  if (event.target instanceof HTMLInputElement) onActivatorSearchUpdate(event.target.value)
}

function onActivatorSearchUpdate(value: string) {
  const nextSearch = value ?? ''
  fieldSearch.value = nextSearch

  if (isSelectedItemDisplayText(nextSearch)) {
    if (isInitialized.value && search.value !== '') {
      onSearchUpdate('')
    }
    return
  }

  openMenu()

  if (!isInitialized.value) {
    return
  }

  onSearchUpdate(getTableSearchValue())
}

function clearSelection() {
  selectionRequest++
  selectedItem.value = null
  clearSearch()
}

function openMenu() {
  if (!props.disabled) {
    menuOpen.value = true
  }
}

function closeAutocompleteMenu() {
  // The autocomplete is only used as an input surface. Results are rendered by SaplingTable.
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
  return isSelectedItemDisplayText(fieldSearch.value) ? '' : fieldSearch.value
}

function getAutocompleteItemTitle(item: unknown) {
  return getValueLabel(resolveSaplingItem(item))
}

function getAutocompleteItemLines(item: unknown) {
  return getValueLabelLines(resolveSaplingItem(item))
}

function isSelectedItemDisplayText(value: string) {
  if (!displayedSelectedItem.value || !value) {
    return false
  }

  return value === getAutocompleteItemTitle(displayedSelectedItem.value)
}

function initializeReferenceEntityState() {
  return initializeEntityState({
    initialSearch: getTableSearchValue(),
    beforeInitialLoad: async () => {
      // Table initialization restores URL filters. Reference fields do not use
      // URL state, so reapply the latest dependency filter before the very
      // first request instead of briefly (or permanently) loading all rows.
      parentFilter.value = normalizeFilter(props.parentFilter)
      if (props.defaultCurrentPersonFilter) {
        const personField = entityTemplates.value.find(
          (field) => field.options?.includes('isPerson') && field.fieldAccess?.allowRead !== false,
        )
        if (personField) {
          const currentPerson = useCurrentPersonStore()
          await currentPerson.fetchCurrentPerson()
          if (currentPerson.person?.handle != null) {
            columnFilters.value = {
              ...columnFilters.value,
              [personField.name]: {
                operator: 'eq',
                value: '',
                relationItems: [currentPerson.person],
              },
            }
          }
        }
      }
    },
  })
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
    items.value = []
    totalItems.value = 0
    if (page.value !== 1) {
      page.value = 1
    }

    if (menuOpen.value && !isInitialized.value) {
      void initializeReferenceEntityState()
    }
  },
  { immediate: true, deep: true },
)

watch(
  () =>
    [
      props.entityHandle,
      getItemHandle(selectedItem.value),
      entityTemplates.value,
      props.placeholder,
    ] as const,
  async () => {
    const currentRequestId = ++selectedItemHydrationRequestId
    hydratedSelectedItem.value = null

    // The target metadata also determines whether this field reserves one or
    // multiple label lines. Load it even for an empty selection so the field's
    // height does not depend on whether a value is currently present.
    await ensureEntityMetadataLoaded()

    if (!selectedItem.value && !props.placeholder) {
      return
    }

    const item = selectedItem.value
    const handle = getItemHandle(item)
    if (!item || handle == null || !hasIncompleteValueData(item, entityTemplates.value)) {
      return
    }

    try {
      const response = await ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
        filter: { handle },
        limit: 1,
        relations: getDialogRecordRelations(entityTemplates.value),
      })
      const hydratedItem = response.data[0] ?? null

      if (
        currentRequestId === selectedItemHydrationRequestId &&
        getItemHandle(selectedItem.value) === handle &&
        getItemHandle(hydratedItem) === handle
      ) {
        hydratedSelectedItem.value = hydratedItem
      }
    } catch {
      // Keep the original selection when its display-only hydration fails.
    }
  },
  { immediate: true },
)

watch(
  () => props.entityHandle,
  () => handleRecordDialogVisibility(false),
)

watch(placeholderSelectionKey, (nextKey) => {
  resolvedPlaceholderSelectionKey.value = !props.placeholder || props.modelValue ? nextKey : null
})

watch(menuOpen, async (isOpen) => {
  if (!isOpen) {
    return
  }

  if (!isInitialized.value) {
    await initializeReferenceEntityState()
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

watch(
  () => [entityTemplates.value, isLoading.value],
  async ([templates, loading]) => {
    const selectionKey = placeholderSelectionKey.value
    if (
      !loading &&
      templates &&
      props.placeholder &&
      !selectedItem.value &&
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
        !selectedItem.value &&
        response.data &&
        response.data.length > 0
      ) {
        selectedItem.value = response.data[0] as SaplingGenericItem
      }
    }
  },
  { immediate: true },
)

watch(selectedItem, (val) => {
  emit('update:modelValue', val)
})

async function ensureEntityMetadataLoaded() {
  if (!props.entityHandle || entityTemplates.value.length > 0) {
    return
  }

  await genericStore.loadGeneric(props.entityHandle, 'global', 'filter', 'exception')
}
</script>
