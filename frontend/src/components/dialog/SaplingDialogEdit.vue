<template>
  <SaplingDialog
    :model-value="modelValue"
    @update:model-value="handleDialogUpdate"
    size="3xl"
    :height="SAPLING_DIALOG_HEIGHT.xl"
    persistent
    @keydown.esc.stop.prevent="cancel"
  >
    <SaplingDialogCard class="sapling-dialog-card--fill" :tilt="false" :close="cancel">
      <div
        data-tutorial="table-record-dialog"
        class="sapling-stack-xl sapling-record-dialog-shell sapling-dialog-edit-shell"
        @keydown="onDialogKeydown"
      >
        <SaplingDialogEditHeader
          data-tutorial="table-record-dialog-header"
          :loading="isLoading"
          :eyebrow="entityLabel"
          :title="dialogTitle"
          :created-at-title="createdAtTitle"
          :created-at-label="createdAtLabel"
          :updated-at-title="updatedAtTitle"
          :updated-at-label="updatedAtLabel"
          :selected-form-config-chip-label="selectedFormConfigChipLabel"
          :dirty-change-count="dirtyChangeCount"
          :dirty-summary-label="dirtySummaryLabel"
          :mode="mode"
          :can-open-form-config-editor="canOpenFormConfigEditor"
          :is-small-viewport="isSmallViewport"
          @open-form-config="openFormConfigEditor"
        />
        <v-card-text
          data-tutorial="table-record-dialog-fields"
          class="sapling-record-dialog-content sapling-dialog-edit-content"
        >
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
            <div class="sapling-record-dialog-body sapling-dialog-edit-body">
              <SaplingDialogEditNavigation
                v-model:active-tab="activeTab"
                :entity-handle="entityHandle"
                :entity-label="entityLabel"
                :mode="mode"
                :relation-templates="relationTemplates"
                :dirty-field-count="dirtyFieldCount"
                :dirty-relation-names="dirtyRelationNames"
                :relation-entities="relationEntities"
                :tab-id-prefix="dialogTabIdPrefix"
                :relations-locked="mode === 'create' && Boolean(parent)"
                :supplemental-tabs="supplementalTabs"
              />
              <v-window
                v-model="activeTab"
                class="sapling-record-dialog-window sapling-dialog-edit-window"
                :transition="false"
                :reverse-transition="false"
              >
                <v-window-item
                  :id="`${dialogTabIdPrefix}-panel-0`"
                  :value="0"
                  role="tabpanel"
                  :aria-labelledby="`${dialogTabIdPrefix}-tab-0`"
                  class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
                  :transition="false"
                  :reverse-transition="false"
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
                            :has-date-range-error="hasDateRangeError"
                            :is-template-recommendation-active="isTemplateRecommendationActive"
                            :get-recommendation-message="getRecommendationMessage"
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
                  :id="`${dialogTabIdPrefix}-panel-${idx + 1}`"
                  :key="template.name"
                  :value="idx + 1"
                  role="tabpanel"
                  :aria-labelledby="`${dialogTabIdPrefix}-tab-${idx + 1}`"
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
                    :parent-draft="form"
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
                    :is-mutating="relationMutationState[template.name] === true"
                    :is-initial-loading="relationTableLoaded[template.name] !== true"
                    @update:selected-relations="
                      (val) => updateSelectedRelationItems(template.name, val)
                    "
                    @update:selected-items="updateSelectedRelationTableItems"
                    @add-relation="addRelation(template)"
                    @remove-relation="removeRelation(template, selectedItems)"
                    @create-relation-record="
                      (value, context) => stageNewRelationRecord(template, value, context)
                    "
                    @update:search="(val) => onRelationSearch(template.name, val)"
                    @update:page="(val) => onRelationTablePage(template.name, val)"
                    @update:items-per-page="
                      (val) => onRelationTableItemsPerPage(template.name, val)
                    "
                    @update:sort-by="(val) => onRelationTableSort(template.name, val)"
                    @update:column-filters="
                      (val) => onRelationTableColumnFilters(template.name, val)
                    "
                    @reload="onRelationTableReload(template.name)"
                  />
                </v-window-item>
                <v-window-item
                  v-if="canShowInformationTab"
                  :id="`${dialogTabIdPrefix}-panel-${informationTabIndex}`"
                  :value="informationTabIndex"
                  role="tabpanel"
                  :aria-labelledby="`${dialogTabIdPrefix}-tab-${informationTabIndex}`"
                  class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
                  :transition="false"
                  :reverse-transition="false"
                >
                  <SaplingDialogEditInformationTab
                    v-if="hasOpenedInformationTab"
                    ref="informationTabRef"
                    :item="item"
                    :entity-handle="entityHandle"
                    @update:dirty="handleInformationDirtyUpdate"
                  />
                </v-window-item>
                <v-window-item
                  v-if="canShowDocumentsTab"
                  :id="`${dialogTabIdPrefix}-panel-${documentsTabIndex}`"
                  :value="documentsTabIndex"
                  role="tabpanel"
                  :aria-labelledby="`${dialogTabIdPrefix}-tab-${documentsTabIndex}`"
                  class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
                  :transition="false"
                  :reverse-transition="false"
                >
                  <SaplingDialogEditDocumentsTab
                    v-if="hasOpenedDocumentsTab"
                    :item="item"
                    :entity-handle="entityHandle"
                    :can-upload="canUploadDocuments"
                  />
                </v-window-item>
                <v-window-item
                  v-if="canShowEmailsTab"
                  :id="`${dialogTabIdPrefix}-panel-${emailsTabIndex}`"
                  :value="emailsTabIndex"
                  role="tabpanel"
                  :aria-labelledby="`${dialogTabIdPrefix}-tab-${emailsTabIndex}`"
                  class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
                  :transition="false"
                  :reverse-transition="false"
                >
                  <SaplingDialogEditCommunicationTab
                    v-if="hasOpenedEmailsTab"
                    kind="email"
                    :item="item"
                    :draft-values="form"
                    :record-entity-handle="entityHandle"
                    :can-create="canComposeEmails"
                    :email-actions="recordEmailActions"
                    :record-label="emailRecordDisplayValue"
                  />
                </v-window-item>
                <v-window-item
                  v-if="canShowPhoneCallsTab"
                  :id="`${dialogTabIdPrefix}-panel-${phoneCallsTabIndex}`"
                  :value="phoneCallsTabIndex"
                  role="tabpanel"
                  :aria-labelledby="`${dialogTabIdPrefix}-tab-${phoneCallsTabIndex}`"
                  class="sapling-record-dialog-window-item sapling-dialog-edit-window-item"
                  :transition="false"
                  :reverse-transition="false"
                >
                  <SaplingDialogEditCommunicationTab
                    v-if="hasOpenedPhoneCallsTab"
                    kind="phoneCall"
                    :item="item"
                    :draft-values="form"
                    :record-entity-handle="entityHandle"
                    :can-create="canCreatePhoneCalls"
                    :phone-number="recordPhoneNumber"
                    :record-label="phoneRecordDisplayValue"
                  />
                </v-window-item>
              </v-window>
            </div>
          </template>
        </v-card-text>
        <SaplingDialogEditActions
          data-tutorial="table-record-dialog-actions"
          :mode="mode"
          :is-loading="isLoading"
          :is-dirty="isDirty"
          :can-submit="canSubmit"
          :is-saving="isSaving"
          :pending-save-action="pendingSaveAction"
          :validation-feedback="validationFeedback"
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
  </SaplingDialog>

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
import { computed, getCurrentInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import type { EntityItem } from '@/entity/entity'
import { useSaplingDialogEdit } from '@/composables/dialog/useSaplingDialogEdit'
import { useSaplingDialogKeyboardShortcuts } from '@/composables/dialog/useSaplingDialogKeyboardShortcuts'
import { useSaplingDialogRecordActions } from '@/composables/dialog/useSaplingDialogRecordActions'
import { useSaplingViewport } from '@/composables/useSaplingViewport'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useSaplingDialogSupplementalTabs } from '@/composables/dialog/useSaplingDialogSupplementalTabs'
import { useSaplingDialogPresentation } from '@/composables/dialog/useSaplingDialogPresentation'
import { useSaplingDialogFocusManagement } from '@/composables/dialog/useSaplingDialogFocusManagement'
import { useSaplingDialogInformationTab } from '@/composables/dialog/useSaplingDialogInformationTab'
import type {
  SaplingDialogEditComponentEmit,
  SaplingDialogEditProps,
} from '@/composables/dialog/saplingDialogEdit.types'
import SaplingDialogCard from '@/components/dialog/SaplingDialogCard.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'
import SaplingDialogEditActions from '@/components/dialog/SaplingDialogEditActions.vue'
import SaplingDialogEditFormSections from '@/components/dialog/SaplingDialogEditFormSections.vue'
import SaplingDialogEditHeader from '@/components/dialog/SaplingDialogEditHeader.vue'
import SaplingDialogEditNavigation from '@/components/dialog/SaplingDialogEditNavigation.vue'
import SaplingDialogEditCommunicationTab from '@/components/dialog/SaplingDialogEditCommunicationTab.vue'
import SaplingDialogEditDocumentsTab from '@/components/dialog/SaplingDialogEditDocumentsTab.vue'
import SaplingDialogEditInformationTab from '@/components/dialog/SaplingDialogEditInformationTab.vue'
import SaplingDialogRecordActionDialogs from '@/components/dialog/SaplingDialogRecordActionDialogs.vue'
import SaplingDialogUnsavedChanges from '@/components/dialog/SaplingDialogUnsavedChanges.vue'
import SaplingDialogEditRelationTab from './SaplingDialogEditRelationTab.vue'
// #endregion

// #region Props & Emits
const props = defineProps<SaplingDialogEditProps>()
const emit = defineEmits<SaplingDialogEditComponentEmit>()
// #endregion

const { t } = useI18n()
useTranslationLoader('navigationGroup')
const { isSmallViewport } = useSaplingViewport()

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

const {
  informationTabRef,
  informationDirty,
  handleInformationDirtyUpdate,
  persistInformationChanges,
  resetInformationChanges,
} = useSaplingDialogInformationTab()

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
  dirtyRelationNames,
  relationTableHeaders,
  relationTableState,
  relationTableItems,
  relationTableSearch,
  relationTablePage,
  relationTableTotal,
  relationTableItemsPerPage,
  relationTableSortBy,
  relationTableColumnFilters,
  relationMutationState,
  relationTableLoaded,
  permissions,
  iconNames,
  selectedItems,
  isDirty,
  canSubmit,
  isSaving,
  unsavedChangesDialog,
  pendingSaveAction,
  validationFeedback,
  dirtyFieldCount,
  formConfigMenuItems,
  selectedFormConfigLabel,
  selectFormConfig,
  getRules,
  hasDateRangeError,
  isTemplateRecommendationActive,
  getRecommendationMessage,
  getTemplateColumnProps,
  isTemplateDirty,
  getDirtyTemplateCount,
  isFieldDisabled,
  isReferenceFieldDisabled,
  getReferenceParentFilter,
  updateFormField,
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
  stageNewRelationRecord,
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
  allowPristineCreate: computed(() => props.allowPristineCreate === true),
  hasSupplementalChanges: computed(() => informationDirty.value),
  persistSupplementalChanges: persistInformationChanges,
  resetSupplementalChanges: resetInformationChanges,
})

const dialogTabIdPrefix = `sapling-record-dialog-${getCurrentInstance()?.uid ?? 'record'}`

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

const { onDialogKeydown } = useSaplingDialogKeyboardShortcuts({
  cancel,
  save,
  saveAndClose,
})

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

const relationEntities = computed<Record<string, EntityItem | null>>(() =>
  Object.fromEntries(
    relationTemplates.value.map((template) => [
      template.name,
      relationTableState.value[template.name]?.entity ?? null,
    ]),
  ),
)

const {
  itemHandle,
  informationTabIndex,
  documentsTabIndex,
  emailsTabIndex,
  phoneCallsTabIndex,
  canShowInformationTab,
  canShowDocumentsTab,
  canShowEmailsTab,
  canShowPhoneCallsTab,
  canUploadDocuments,
  canComposeEmails,
  canCreatePhoneCalls,
  recordPhoneNumber,
  recordEmailActions,
  emailRecordDisplayValue,
  phoneRecordDisplayValue,
  supplementalTabs,
  hasOpenedInformationTab,
  hasOpenedDocumentsTab,
  hasOpenedEmailsTab,
  hasOpenedPhoneCallsTab,
} = useSaplingDialogSupplementalTabs(props, {
  activeTab,
  form,
  informationDirty,
  isSmallViewport,
  permissions,
  relationTemplates,
})

const {
  createdAtTitle,
  updatedAtTitle,
  createdAtLabel,
  updatedAtLabel,
  selectedFormConfigChipLabel,
  resetButtonLabel,
  dirtyChangeCount,
  dirtySummaryLabel,
  expandedGroupIds,
  syncExpandedGroups,
  isGroupExpanded,
  toggleGroup,
  isGroupDirty,
  updateSelectedRelationItems,
  updateSelectedRelationTableItems,
  onRelationSearch,
} = useSaplingDialogPresentation(props, {
  dirtyFieldCount,
  dirtyRelationNames,
  getDirtyTemplateCount,
  informationDirty,
  onRelationTablePage,
  relationTablePage,
  relationTableSearch,
  selectedFormConfigLabel,
  selectedItems,
  selectedRelations,
  visibleTemplateGroups,
})

const { formSurfaceRef } = useSaplingDialogFocusManagement(props, {
  activeTab,
  expandedGroupIds,
  isLoading,
  syncExpandedGroups,
  validationFeedback,
})
// #endregion
</script>
