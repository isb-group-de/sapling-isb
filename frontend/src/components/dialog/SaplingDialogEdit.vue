<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="handleDialogUpdate"
    :max-width="SAPLING_DIALOG_MAX_WIDTH['3xl']"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    persistent
  >
    <SaplingDialogCard class="sapling-dialog-card--fill" :tilt="false" :close="cancel">
      <div
        class="sapling-stack-xl sapling-record-dialog-shell sapling-dialog-edit-shell"
        @keydown="onShellKeydown"
      >
        <SaplingDialogEditHeader
          :loading="isLoading"
          :eyebrow="entityLabel"
          :title="dialogTitle"
          :created-at-title="createdAtTitle"
          :created-at-label="createdAtLabel"
          :updated-at-title="updatedAtTitle"
          :updated-at-label="updatedAtLabel"
          :selected-form-config-chip-label="selectedFormConfigChipLabel"
          :is-dirty="isDirty"
          :dirty-summary-label="dirtySummaryLabel"
          :mode="mode"
          :can-open-form-config-editor="canOpenFormConfigEditor"
          @open-form-config="openFormConfigEditor"
        />
        <v-card-text class="sapling-record-dialog-content sapling-dialog-edit-content">
          <template v-if="isLoading">
            <div class="sapling-stack-xl sapling-record-dialog-loading sapling-dialog-edit-loading">
              <v-skeleton-loader
                class="sapling-record-dialog-loading__tabs sapling-dialog-edit-loading__tabs"
                elevation="12"
                type="heading"
              />
              <v-skeleton-loader
                class="sapling-record-dialog-skeleton sapling-dialog-edit-skeleton"
                elevation="12"
                type="table"
              />
            </div>
          </template>
          <template v-else>
            <div class="sapling-dialog-edit-tabs-shell">
              <v-tabs v-model="activeTab" class="sapling-record-dialog-tabs" grow>
                <v-tab class="sapling-record-dialog-tab sapling-dialog-edit-tab">
                  {{ entityLabel }}
                </v-tab>
                <template v-if="mode !== 'create'">
                  <v-tab
                    v-for="template in relationTemplates"
                    :key="template.name"
                    class="sapling-record-dialog-tab sapling-dialog-edit-tab"
                  >
                    {{ $t(`${entity?.handle}.${template.name}`) }}
                  </v-tab>
                </template>
              </v-tabs>
            </div>
            <v-window
              v-model="activeTab"
              class="sapling-record-dialog-window sapling-dialog-edit-window"
            >
              <v-window-item
                :value="0"
                class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
              >
                <div class="sapling-record-dialog-tab-scroll sapling-dialog-edit-tab-scroll">
                  <div
                    ref="formSurfaceRef"
                    class="sapling-stack-lg sapling-record-dialog-surface sapling-dialog-edit-form-surface"
                  >
                    <v-form
                      ref="formRef"
                      class="sapling-record-dialog-form sapling-dialog-edit-form"
                      @submit.prevent="save"
                    >
                      <v-defaults-provider :defaults="dialogFieldDefaults">
                        <SaplingDialogEditFormSections
                          :groups="visibleTemplateGroups"
                          :mode="mode"
                          :entity-handle="entityHandle"
                          :item-handle="itemHandle"
                          :form-values="form"
                          :visible-templates="visibleTemplates"
                          :permissions="permissions"
                          :icon-names="iconNames"
                          :is-reference-visible="isReferenceVisible"
                          :is-group-expanded="isGroupExpanded"
                          :is-group-dirty="isGroupDirty"
                          :is-template-dirty="isTemplateDirty"
                          :get-template-column-props="getTemplateColumnProps"
                          :get-rules="getRules"
                          :is-field-disabled="isFieldDisabled"
                          :is-reference-field-disabled="isReferenceFieldDisabled"
                          :get-reference-parent-filter="getReferenceParentFilter"
                          @toggle-group="toggleGroup"
                          @update-field="updateFormField"
                          @select-record="onDuplicateSelect"
                        />
                      </v-defaults-provider>
                    </v-form>
                  </div>
                </div>
              </v-window-item>
              <v-window-item
                v-for="(template, idx) in relationTemplates"
                :key="template.name"
                :value="idx + 1"
                class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
                :transition="false"
                :reverse-transition="false"
              >
                <SaplingDialogEditRelationTab
                  v-if="activeTab === idx + 1"
                  :template="template"
                  :mode="mode"
                  :entity-handle="entity?.handle ?? ''"
                  :entity-label="entityLabel"
                  :item="item"
                  :entity="entity"
                  :headers="relationTableHeaders[template.name] ?? []"
                  :items="relationTableItems[template.name] ?? []"
                  :search="relationTableSearch[template.name] || ''"
                  :page="relationTablePage[template.name] || 1"
                  :items-per-page="
                    relationTableItemsPerPage[template.name] || DEFAULT_PAGE_SIZE_SMALL
                  "
                  :total-items="relationTableTotal[template.name] ?? 0"
                  :is-loading="relationTableState[template.name]?.isLoading ?? false"
                  :sort-by="relationTableSortBy[template.name] || []"
                  :column-filters="relationTableColumnFilters[template.name] || {}"
                  :entity-templates="relationTableState[template.name]?.entityTemplates ?? []"
                  :relation-entity="relationTableState[template.name]?.entity ?? null"
                  :entity-permission="relationTableState[template.name]?.entityPermission ?? null"
                  :selected-relations="selectedRelations[template.name] ?? []"
                  :selected-items="selectedItems ?? []"
                  @update:selected-relations="
                    (val) => updateSelectedRelationItems(template.name, val)
                  "
                  @update:selected-items="updateSelectedRelationTableItems"
                  @add-relation="addRelation(template)"
                  @remove-relation="removeRelation(template, selectedItems)"
                  @update:search="(val) => onRelationSearch(template.name, val)"
                  @update:page="(val) => onRelationTablePage(template.name, val)"
                  @update:items-per-page="(val) => onRelationTableItemsPerPage(template.name, val)"
                  @update:sort-by="(val) => onRelationTableSort(template.name, val)"
                  @update:column-filters="(val) => onRelationTableColumnFilters(template.name, val)"
                  @reload="onRelationTableReload(template.name)"
                />
              </v-window-item>
            </v-window>
          </template>
        </v-card-text>
        <SaplingDialogEditActions
          :mode="mode"
          :is-loading="isLoading"
          :is-dirty="isDirty"
          :is-saving="isSaving"
          :pending-save-action="pendingSaveAction"
          :can-delete-record="canDeleteRecord"
          :record-action-buttons-disabled="recordActionButtonsDisabled"
          :edit-mobile-secondary-actions-disabled="editMobileSecondaryActionsDisabled"
          :has-readonly-mobile-action-menu="hasReadonlyMobileActionMenu"
          :record-action-menu-items="recordActionMenuItems"
          :mobile-record-action-menu-groups="mobileRecordActionMenuGroups"
          :reset-button-label="resetButtonLabel"
          @cancel="cancel"
          @delete="openRecordDeleteDialog"
          @reset="resetForm"
          @save="save"
          @save-and-close="saveAndClose"
          @select-action="handleRecordAction"
        />
      </div>
    </SaplingDialogCard>
  </v-dialog>

  <SaplingDialogRecordActionDialogs
    :record-delete-dialog="recordDeleteDialog"
    :show-upload-dialog="showUploadDialog"
    :show-information-dialog="showInformationDialog"
    :show-external-record-links-dialog="showExternalRecordLinksDialog"
    :item="item"
    :entity-handle="entityHandle"
    @set-record-delete-dialog="recordDeleteDialog = $event"
    @confirm-delete="confirmRecordDelete"
    @cancel-delete="closeRecordDeleteDialog"
    @close-upload="closeUploadDialog"
    @close-information="closeInformationDialog"
    @close-external-record-links="closeExternalRecordLinksDialog"
  />

  <SaplingDialogUnsavedChanges
    :model-value="unsavedChangesDialog"
    :is-saving="isSaving"
    :is-saving-and-closing="pendingSaveAction === 'saveAndClose'"
    @keep-editing="keepEditing"
    @discard="discardChanges"
    @save-and-close="saveChangesAndClose"
  />
</template>

<script lang="ts" setup>
// #region Imports
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import { SAPLING_DIALOG_MAX_WIDTH, SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import { useSaplingDialogEdit } from '@/composables/dialog/useSaplingDialogEdit'
import { useSaplingDialogRecordActions } from '@/composables/dialog/useSaplingDialogRecordActions'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialogEditActions from '@/components/dialog/SaplingDialogEditActions.vue'
import SaplingDialogEditFormSections from '@/components/dialog/SaplingDialogEditFormSections.vue'
import SaplingDialogEditHeader from '@/components/dialog/SaplingDialogEditHeader.vue'
import SaplingDialogRecordActionDialogs from '@/components/dialog/SaplingDialogRecordActionDialogs.vue'
import SaplingDialogUnsavedChanges from '@/components/dialog/SaplingDialogUnsavedChanges.vue'
import SaplingDialogEditRelationTab from './SaplingDialogEditRelationTab.vue'
// #endregion

// #region Props & Emits
const props = defineProps<{
  modelValue: boolean
  mode: DialogState
  item: SaplingGenericItem | null
  parent?: SaplingGenericItem | null
  parentEntity?: EntityItem | null
  templates: EntityTemplate[]
  entity: EntityItem | null
  showReference?: boolean
  forceDirty?: boolean
  forceDirtyFields?: string[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  // The edit dialog emits entity-specific payloads that vary by template.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (event: 'save', value: any, action: DialogSaveAction, context: DialogSaveContext): void
  (event: 'cancel'): void
  (event: 'update:mode', value: DialogState): void
  (event: 'update:item', value: SaplingGenericItem | null): void
  (event: 'deleted', value: SaplingGenericItem | null): void
}>()
// #endregion

const { t, d, te } = useI18n()

const dialogFieldDefaults = {
  VAutocomplete: {
    density: 'compact',
    hideDetails: 'auto',
  },
  VSelect: {
    density: 'compact',
    hideDetails: 'auto',
  },
  VTextarea: {
    density: 'compact',
    hideDetails: 'auto',
  },
  VTextField: {
    density: 'compact',
    hideDetails: 'auto',
  },
}

// #region Composable
const {
  isLoading,
  form,
  formRef,
  activeTab,
  selectedRelations,
  visibleTemplates,
  visibleTemplateGroups,
  relationTemplates,
  relationTableHeaders,
  relationTableState,
  relationTableItems,
  relationTableSearch,
  relationTablePage,
  relationTableTotal,
  relationTableItemsPerPage,
  relationTableSortBy,
  relationTableColumnFilters,
  permissions,
  iconNames,
  selectedItems,
  isDirty,
  isSaving,
  unsavedChangesDialog,
  pendingSaveAction,
  dirtyFieldCount,
  formConfigMenuItems,
  selectedFormConfigLabel,
  selectFormConfig,
  getRules,
  getTemplateColumnProps,
  isTemplateDirty,
  getDirtyTemplateCount,
  isFieldDisabled,
  isReferenceFieldDisabled,
  getReferenceParentFilter,
  handleDialogUpdate,
  onDuplicateSelect,
  cancel,
  keepEditing,
  discardChanges,
  saveChangesAndClose,
  resetForm,
  save,
  saveAndClose,
  addRelation,
  removeRelation,
  onRelationTablePage,
  onRelationTableItemsPerPage,
  onRelationTableSort,
  onRelationTableColumnFilters,
  onRelationTableReload,
} = useSaplingDialogEdit(props, emit, {
  forceDirty: computed(() => props.forceDirty === true),
  forceDirtyFields: computed(() =>
    Array.isArray(props.forceDirtyFields) ? props.forceDirtyFields : [],
  ),
})

const formSurfaceRef = ref<HTMLElement | null>(null)

const {
  canDeleteRecord,
  canOpenFormConfigEditor,
  editMobileSecondaryActionsDisabled,
  hasReadonlyMobileActionMenu,
  mobileRecordActionMenuGroups,
  recordActionButtonsDisabled,
  recordActionMenuItems,
  recordDeleteDialog,
  showExternalRecordLinksDialog,
  showInformationDialog,
  showUploadDialog,
  closeExternalRecordLinksDialog,
  closeInformationDialog,
  closeRecordDeleteDialog,
  closeUploadDialog,
  confirmRecordDelete,
  handleRecordAction,
  openFormConfigEditor,
  openRecordDeleteDialog,
} = useSaplingDialogRecordActions(props, emit, {
  activeTab,
  form,
  formConfigMenuItems,
  isDirty,
  isSaving,
  permissions,
  selectFormConfig,
})

function onShellKeydown(event: KeyboardEvent) {
  // Keyboard shortcuts inside the edit dialog:
  //   Ctrl/Cmd + S        -> save (keep dialog open)
  //   Ctrl/Cmd + Enter    -> save & close
  //   Escape              -> cancel (uses unsaved-changes confirmation when dirty)
  const isMod = event.ctrlKey || event.metaKey
  if (event.repeat) {
    return
  }

  if (isMod && !event.altKey && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
    return
  }

  if (isMod && !event.altKey && event.key === 'Enter') {
    event.preventDefault()
    void saveAndClose()
    return
  }

  if (event.key === 'Escape' && !isMod && !event.altKey) {
    event.preventDefault()
    cancel()
  }
}

const entityLabel = computed(() =>
  props.entity?.handle ? t(`navigation.${props.entity.handle}`) : '',
)

const isReferenceVisible = computed(() => props.showReference !== false)

const dialogTitle = computed(() => {
  switch (props.mode) {
    case 'create':
      return t('global.createRecord')
    case 'edit':
      return t('global.editRecord')
    default:
      return entityLabel.value
  }
})

const entityHandle = computed(() => props.entity?.handle ?? '')

const itemHandle = computed<string | number | null>(() => {
  const handle = props.item?.handle
  return typeof handle === 'string' || typeof handle === 'number' ? handle : null
})

function getTimestampTitle(field: 'createdAt' | 'updatedAt'): string {
  const entityHandle = props.entity?.handle
  const entityKey = entityHandle ? `${entityHandle}.${field}` : ''

  if (entityKey && te(entityKey)) {
    return t(entityKey)
  }

  return t(`global.${field}`)
}

function formatTimestamp(value: unknown): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? '' : d(date)
}

const createdAtTitle = computed(() => getTimestampTitle('createdAt'))
const updatedAtTitle = computed(() => getTimestampTitle('updatedAt'))
const createdAtLabel = computed(() => formatTimestamp(props.item?.createdAt))
const updatedAtLabel = computed(() => formatTimestamp(props.item?.updatedAt))
const selectedFormConfigChipLabel = computed(() =>
  selectedFormConfigLabel.value
    ? `${t('formConfig.currentView')}: ${selectedFormConfigLabel.value}`
    : '',
)

const resetButtonLabel = computed(() => t('filter.reset'))

const dirtySummaryLabel = computed(() => {
  if (dirtyFieldCount.value <= 0) {
    return ''
  }

  return t('global.dirtyFieldCount', { count: dirtyFieldCount.value }, dirtyFieldCount.value)
})

const expandedGroupIds = ref<string[]>([])

function syncExpandedGroups(forceOpenAll = false): void {
  const groupIds = visibleTemplateGroups.value.map((group) => group.id)

  if (forceOpenAll) {
    expandedGroupIds.value = groupIds
    return
  }

  const expandedGroupSet = new Set(expandedGroupIds.value)
  groupIds.forEach((groupId) => expandedGroupSet.add(groupId))
  expandedGroupIds.value = groupIds.filter((groupId) => expandedGroupSet.has(groupId))
}

function isGroupExpanded(groupId: string): boolean {
  return expandedGroupIds.value.includes(groupId)
}

function toggleGroup(groupId: string): void {
  if (isGroupExpanded(groupId)) {
    expandedGroupIds.value = expandedGroupIds.value.filter((id) => id !== groupId)
    return
  }

  expandedGroupIds.value = [...expandedGroupIds.value, groupId]
}

function isGroupDirty(templates: EntityTemplate[]): boolean {
  return getDirtyTemplateCount(templates) > 0
}

function updateFormField(key: string, value: unknown): void {
  form.value[key] = value
  applyReferenceTemplate(key, value)
}

function applyReferenceTemplate(key: string, value: unknown): void {
  if (!value || typeof value !== 'object') {
    return
  }

  const template = visibleTemplates.value.find((entry) => entry.name === key)
  const mappings = template?.referenceTemplate?.mappings ?? []
  if (mappings.length === 0) {
    return
  }

  const source = value as Record<string, unknown>
  mappings.forEach((mapping) => {
    if (!mapping.sourceField || !mapping.targetField) {
      return
    }

    const nextValue = source[mapping.sourceField]
    if (nextValue === undefined || nextValue === null) {
      return
    }

    const currentValue = form.value[mapping.targetField]
    const hasCurrentValue =
      currentValue !== undefined &&
      currentValue !== null &&
      currentValue !== '' &&
      (!Array.isArray(currentValue) || currentValue.length > 0)

    if (mapping.overwrite === false && hasCurrentValue) {
      return
    }

    form.value[mapping.targetField] = nextValue
  })
}

function updateSelectedRelationItems(templateName: string, items: SaplingGenericItem[]): void {
  selectedRelations.value[templateName] = items
}

function updateSelectedRelationTableItems(items: SaplingGenericItem[]): void {
  selectedItems.value = items
}

function onRelationSearch(templateName: string, search: string): void {
  relationTableSearch.value[templateName] = search
  relationTablePage.value[templateName] = 1
  onRelationTablePage(templateName, 1)
}

watch(visibleTemplateGroups, () => syncExpandedGroups(), { immediate: true })

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      syncExpandedGroups(true)
    }
  },
)

/**
 * Auto-focus the first editable, non-disabled input once the dialog has
 * finished its initial loading. Saves the user a `Tab` step when entering
 * data and matches typical CRUD UX conventions.
 */
async function focusFirstField(): Promise<void> {
  if (props.mode === 'readonly') {
    return
  }

  await nextTick()
  const surface = formSurfaceRef.value
  if (!surface) {
    return
  }

  const candidates = surface.querySelectorAll<HTMLElement>(
    'input:not([type=hidden]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])',
  )

  for (const candidate of Array.from(candidates)) {
    if (candidate.offsetParent === null) {
      continue
    }
    if (candidate.getAttribute('aria-hidden') === 'true') {
      continue
    }
    candidate.focus({ preventScroll: true })
    if (candidate instanceof HTMLInputElement && candidate.type === 'text') {
      candidate.select?.()
    }
    return
  }
}

watch(
  () => [props.modelValue, isLoading.value, props.mode] as const,
  ([isOpen, loading]) => {
    if (isOpen && !loading) {
      void focusFirstField()
    }
  },
)
// #endregion
</script>
