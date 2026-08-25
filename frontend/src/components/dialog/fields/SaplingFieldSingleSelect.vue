<template>
  <div
    ref="fieldRootRef"
    class="sapling-field-single-select"
    :class="{
      'sapling-field-single-select--with-open-action': props.showOpenAction,
      'sapling-field-single-select--multiline': reservesMultilineSelection,
    }"
    @focusout="closeMenuWhenFocusLeaves"
    @keydown.tab.capture="closeMenuOnTab"
    @keydown.esc="closeMenuOnEscape"
  >
    <v-menu
      v-model="menuOpen"
      max-width="600px"
      :close-on-content-click="false"
      :open-on-click="false"
      scroll-strategy="block"
    >
      <template #activator="{ props: activatorProps }">
        <div v-bind="activatorProps" class="sapling-field-select__activator">
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
            @keydown.down.prevent="focusFirstMenuRow"
            @focus="openMenu"
            @mousedown:control="openMenu"
            @click:clear="clearSelection"
            @update:menu="closeAutocompleteMenu"
            @update:model-value="onActivatorModelUpdate"
            @update:search="onActivatorSearchUpdate"
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
      <div
        ref="menuSurfaceRef"
        class="glass-panel sapling-menu-surface sapling-menu-surface--field-table"
        @focusout="closeMenuWhenFocusLeaves"
        @keydown.tab.capture="closeMenuOnTab"
        @keydown.esc="closeMenuOnEscape"
        @keydown.down.prevent="moveMenuRowFocus(1)"
        @keydown.up.prevent="moveMenuRowFocus(-1)"
      >
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
          :multi-select="false"
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
      </div>
    </v-menu>

    <v-tooltip v-if="props.showOpenAction" location="top" :text="openActionLabel">
      <template #activator="{ props: tooltipProps }">
        <v-btn
          v-bind="tooltipProps"
          class="sapling-button--icon sapling-field-action-button sapling-field-single-select__open-action"
          data-test="open-reference-record"
          icon="mdi-open-in-new"
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
import SaplingDialogEdit from '@/components/dialog/SaplingDialogEdit.vue'
import type { SaplingGenericItem } from '@/entity/entity'
import { useSaplingTable } from '@/composables/table/useSaplingTable'
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSaplingSingleSelectField } from '@/composables/fields/useSaplingSingleSelectField'
import { useSaplingEntityValueLabel } from '@/composables/fields/useSaplingEntityValueLabel'
import { useSaplingReferenceFilter } from '@/composables/fields/useSaplingReferenceFilter'
import { useSaplingFieldDropdownFocus } from '@/composables/fields/useSaplingFieldDropdownFocus'
import { getDialogRecordRelations } from '@/composables/dialog/saplingDialogRecordLoader'
import {
  buildConcurrencyOptions,
  getItemHandle,
} from '@/composables/table/saplingTableAction.utils'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import ApiGenericService, { type FilterQuery } from '@/services/api.generic.service'
import { useGenericStore } from '@/stores/genericStore'
import { saplingTableDisplayContextKey } from '@/components/table/saplingTableDisplayContext'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
// #endregion

// #region Props and Emits
const props = withDefaults(
  defineProps<{
    label: string
    entityHandle: string
    modelValue?: SaplingGenericItem | null | undefined
    rules?: Array<(v: unknown) => true | string>
    placeholder?: string
    disabled?: boolean
    parentFilter?: FilterQuery
    dependencyTargetField?: string
    density?: 'default' | 'comfortable' | 'compact'
    hideDetails?: boolean | 'auto'
    showOpenAction?: boolean
    openActionLabel?: string
  }>(),
  {
    hideDetails: 'auto',
    showOpenAction: false,
    openActionLabel: '',
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
} = useSaplingTable(ref(props.entityHandle), DEFAULT_PAGE_SIZE_SMALL, false, false, () => ({}), [
  ...(props.dependencyTargetField ? [props.dependencyTargetField] : []),
])

const { selectedItem, menuOpen } = useSaplingSingleSelectField(props)
const {
  fieldRootRef,
  menuSurfaceRef,
  closeMenuOnTab,
  closeMenuOnEscape,
  closeMenuWhenFocusLeaves,
  focusFirstMenuRow,
  moveMenuRowFocus,
} = useSaplingFieldDropdownFocus(menuOpen)
const { getValueLabel, getValueLabelLines } = useSaplingEntityValueLabel(entityTemplates)
const { combineFilters, normalizeFilter, areFiltersEqual } = useSaplingReferenceFilter()
const fieldSearch = ref('')
const autocompleteItems = ref<SaplingGenericItem[]>([])
const genericStore = useGenericStore()
const tableDisplayContext = inject(saplingTableDisplayContextKey, null)
const disableDropdownMobileView = computed(() => tableDisplayContext?.isMobileTable.value === false)
const { t } = useI18n()
const { pushMessage } = useSaplingMessageCenter()
const recordDialogOpen = ref(false)
const recordDialogItem = ref<SaplingGenericItem | null>(null)
const hydratedSelectedItem = ref<SaplingGenericItem | null>(null)
const isRecordDialogLoading = ref(false)
let selectedItemHydrationRequestId = 0
const recordDialogMode = computed<DialogState>(() =>
  entityPermission.value?.allowUpdate ? 'edit' : 'readonly',
)
const displayedSelectedItem = computed(() =>
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
const openActionLabel = computed(() => props.openActionLabel || t('global.editRecord'))
const canOpenSelectedRecord = computed(
  () =>
    Boolean(props.entityHandle) &&
    getItemHandle(selectedItem.value) != null &&
    !isRecordDialogLoading.value,
)
// #endregion

// #region Selection State
function onTableSelect(newSelected: SaplingGenericItem[]) {
  selectedItem.value = newSelected[0] ?? null
  clearSearch()

  if (newSelected[0]) {
    menuOpen.value = false
  }
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
  selectedItem.value = null
  clearSearch()
}

async function openSelectedRecord() {
  const handle = getItemHandle(selectedItem.value)
  if (!props.entityHandle || handle == null || isRecordDialogLoading.value) {
    return
  }

  menuOpen.value = false
  isRecordDialogLoading.value = true

  try {
    await ensureEntityMetadataLoaded()
    const response = await ApiGenericService.find<SaplingGenericItem>(props.entityHandle, {
      filter: { handle },
      limit: 1,
      relations: getDialogRecordRelations(entityTemplates.value),
    })
    const resolvedItem = response.data[0] ?? null
    if (!resolvedItem) {
      return
    }

    recordDialogItem.value = resolvedItem
    recordDialogOpen.value = true
  } catch {
    recordDialogItem.value = null
  } finally {
    isRecordDialogLoading.value = false
  }
}

function handleRecordDialogVisibility(value: boolean) {
  recordDialogOpen.value = value
  if (!value) {
    recordDialogItem.value = null
  }
}

async function saveRecordDialog(
  value: SaplingGenericItem,
  action: DialogSaveAction,
  context: DialogSaveContext,
) {
  const handle = getItemHandle(recordDialogItem.value)
  if (!props.entityHandle || handle == null || recordDialogMode.value !== 'edit') {
    context.complete(false)
    return
  }

  let didSave = false
  try {
    const updatedItem = await ApiGenericService.update<SaplingGenericItem>(
      props.entityHandle,
      handle,
      value,
      {
        relations: getDialogRecordRelations(entityTemplates.value),
        concurrency: buildConcurrencyOptions(entityTemplates.value, recordDialogItem.value),
      },
    )

    recordDialogItem.value = updatedItem
    selectedItem.value = updatedItem
    didSave = true

    pushMessage(
      'success',
      t('global.recordSaved'),
      t('global.recordSavedDescription'),
      props.entityHandle,
    )

    if (action === 'saveAndClose') {
      handleRecordDialogVisibility(false)
    }
  } catch {
    // ApiGenericService already reports the error. Keep the nested draft open for retrying.
  } finally {
    context.complete(didSave)
  }
}

function handleRecordDeleted() {
  handleRecordDialogVisibility(false)
  clearSelection()
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
    beforeInitialLoad: () => {
      // Table initialization restores URL filters. Reference fields do not use
      // URL state, so reapply the latest dependency filter before the very
      // first request instead of briefly (or permanently) loading all rows.
      parentFilter.value = normalizeFilter(props.parentFilter)
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
    if (!loading && templates && props.placeholder && !selectedItem.value) {
      const response = await ApiGenericService.find(props.entityHandle, {
        filter: combineFilters({ handle: props.placeholder }, props.parentFilter),
        limit: 1,
      })
      if (response.data && response.data.length > 0) {
        selectedItem.value = response.data[0] as SaplingGenericItem
      }
    }
  },
  { immediate: true },
)

watch(selectedItem, (val) => {
  emit('update:modelValue', val)
})

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

function hasIncompleteValueData(item: SaplingGenericItem, templates: EntityTemplate[]): boolean {
  const hasMissingDirectValue = templates.some(
    (template) =>
      template.options?.includes('isValue') &&
      !Object.prototype.hasOwnProperty.call(item, template.name),
  )
  if (hasMissingDirectValue) {
    return true
  }

  return templates.some((template) => {
    if (
      !template.isReference ||
      !['m:1', '1:1'].includes(template.kind ?? '') ||
      !template.options?.includes('isValue')
    ) {
      return false
    }

    const value = item[template.name]
    if (value == null) {
      return false
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return true
    }

    const identifierKeys = new Set(['handle', 'id', ...(template.referencedPks ?? [])])
    return !Object.keys(value).some((key) => !identifierKeys.has(key))
  })
}
</script>
