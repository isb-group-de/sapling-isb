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
          :is-dirty="isDirty"
          :dirty-summary-label="dirtySummaryLabel"
          :mode="mode"
          :can-open-form-config-editor="canOpenFormConfigEditor"
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
                    :email-recipients="recordEmailRecipients"
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
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
import { DEFAULT_PAGE_SIZE_SMALL } from '@/constants/project.constants'
import { SAPLING_DIALOG_HEIGHT } from '@/constants/dialog.constants'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import { useSaplingDialogEdit } from '@/composables/dialog/useSaplingDialogEdit'
import { useSaplingDialogKeyboardShortcuts } from '@/composables/dialog/useSaplingDialogKeyboardShortcuts'
import { useSaplingDialogRecordActions } from '@/composables/dialog/useSaplingDialogRecordActions'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { buildMailMenuActions } from '@/utils/saplingMailMenuUtil'
import ApiTemplateService from '@/services/api.template.service'
import type { EntityValueReferenceTemplates } from '@/utils/saplingTableUtil'
import {
  getCommunicationOwnerReferenceNames,
  getCommunicationRecordLabel,
} from '@/utils/saplingCommunicationRecordUtil'
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
  allowPristineCreate?: boolean
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
useTranslationLoader('navigationGroup')

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

interface InformationTabHandle {
  discardChanges: () => void
  save: () => Promise<boolean>
}

const informationTabRef = ref<InformationTabHandle | null>(null)
const informationDirty = ref(false)

function handleInformationDirtyUpdate(dirty: boolean): void {
  informationDirty.value = dirty
}

async function persistInformationChanges(): Promise<boolean> {
  if (!informationDirty.value) {
    return true
  }

  return (await informationTabRef.value?.save()) ?? false
}

function resetInformationChanges(): void {
  informationTabRef.value?.discardChanges()
  informationDirty.value = false
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

const formSurfaceRef = ref<HTMLElement | null>(null)
const hasFocusedCurrentOpenDialog = ref(false)
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

const itemHandle = computed<string | number | null>(() => {
  const handle = props.item?.handle
  return typeof handle === 'string' || typeof handle === 'number' ? handle : null
})

const informationTabIndex = computed(() => relationTemplates.value.length + 1)
const documentsTabIndex = computed(() => relationTemplates.value.length + 2)
const emailsTabIndex = computed(() => relationTemplates.value.length + 3)
const phoneCallsTabIndex = computed(() => relationTemplates.value.length + 4)
const hasPersistedItem = computed(() => itemHandle.value != null && props.mode !== 'create')
const permissionFor = (entity: string) =>
  permissions.value?.find((permission) => permission.entityHandle === entity)
const canShowInformationTab = computed(() => permissionFor('information')?.allowRead === true)
const canShowDocumentsTab = computed(() => permissionFor('document')?.allowRead === true)
const canShowEmailsTab = computed(() => permissionFor('emailDelivery')?.allowRead === true)
const canShowPhoneCallsTab = computed(() => permissionFor('phoneCall')?.allowRead === true)
const canUploadDocuments = computed(
  () => hasPersistedItem.value && props.entity?.canInsert === true,
)
const canComposeEmails = computed(() => hasPersistedItem.value && props.entity?.canUpdate === true)
const canCreatePhoneCalls = computed(
  () => hasPersistedItem.value && permissionFor('phoneCall')?.allowInsert === true,
)
const recordPhoneTemplate = computed(() =>
  props.templates.find((template) => {
    const value = form.value[template.name]
    return template.options?.includes('isPhone') && value != null && String(value).trim().length > 0
  }),
)

const recordPhoneNumber = computed(() =>
  recordPhoneTemplate.value ? String(form.value[recordPhoneTemplate.value.name] ?? '').trim() : '',
)
const recordEmailActions = computed(() => buildMailMenuActions(props.templates, form.value))
const recordEmailRecipients = computed(() => [
  ...new Set(recordEmailActions.value.map((action) => action.email)),
])
const communicationContactTemplateNames = computed(() => [
  ...new Set([
    ...recordEmailActions.value.map((action) => action.templateName),
    ...(recordPhoneTemplate.value ? [recordPhoneTemplate.value.name] : []),
  ]),
])
const communicationReferenceTemplates = ref<EntityValueReferenceTemplates>({})
let communicationTemplateRequestId = 0

async function loadCommunicationReferenceTemplates(
  initialReferenceNames: string[],
): Promise<EntityValueReferenceTemplates> {
  const loaded: Record<string, EntityTemplate[]> = {}
  const queued = new Set(initialReferenceNames)

  while (queued.size > 0) {
    const referenceNames = [...queued]
    queued.clear()
    const entries = await Promise.all(
      referenceNames.map(async (referenceName) => {
        try {
          return [referenceName, await ApiTemplateService.getEntityTemplate(referenceName)] as const
        } catch {
          return [referenceName, [] as EntityTemplate[]] as const
        }
      }),
    )

    for (const [referenceName, templates] of entries) {
      loaded[referenceName] = templates
      for (const template of templates) {
        const nestedReferenceName = template.referenceName?.trim()
        if (
          template.isReference &&
          template.options?.includes('isValue') &&
          nestedReferenceName &&
          !(nestedReferenceName in loaded)
        ) {
          queued.add(nestedReferenceName)
        }
      }
    }
  }

  return loaded
}

watch(
  () =>
    getCommunicationOwnerReferenceNames(communicationContactTemplateNames.value, props.templates),
  async (referenceNames) => {
    const requestId = ++communicationTemplateRequestId
    const loadedTemplates = await loadCommunicationReferenceTemplates(referenceNames)

    if (requestId === communicationTemplateRequestId) {
      communicationReferenceTemplates.value = loadedTemplates
    }
  },
  { immediate: true },
)

const emailRecordDisplayValue = computed(() =>
  getCommunicationRecordLabel(
    form.value,
    props.templates,
    recordEmailActions.value.map((action) => action.templateName),
    communicationReferenceTemplates.value,
  ),
)
const phoneRecordDisplayValue = computed(() =>
  getCommunicationRecordLabel(
    form.value,
    props.templates,
    recordPhoneTemplate.value ? [recordPhoneTemplate.value.name] : [],
    communicationReferenceTemplates.value,
  ),
)
const emailsTabLabel = computed(() => t('navigationGroup.mails'))

const supplementalDisabledReason = computed(() =>
  hasPersistedItem.value ? '' : t('global.recordContentAvailableAfterSave'),
)

const supplementalTabs = computed(() => {
  const tabs = []

  if (canShowInformationTab.value) {
    tabs.push({
      value: informationTabIndex.value,
      label: t('navigation.information'),
      icon: 'mdi-text-box-edit-outline',
      disabled: !hasPersistedItem.value,
      disabledReason: supplementalDisabledReason.value,
      dirty: informationDirty.value,
    })
  }

  if (canShowDocumentsTab.value) {
    tabs.push({
      value: documentsTabIndex.value,
      label: t('navigation.document'),
      icon: 'mdi-file-document-multiple-outline',
      disabled: !hasPersistedItem.value,
      disabledReason: supplementalDisabledReason.value,
    })
  }

  if (canShowEmailsTab.value && recordEmailRecipients.value.length > 0) {
    tabs.push({
      value: emailsTabIndex.value,
      label: emailsTabLabel.value,
      icon: 'mdi-email-multiple-outline',
      disabled: !hasPersistedItem.value,
      disabledReason: supplementalDisabledReason.value,
    })
  }

  if (canShowPhoneCallsTab.value && recordPhoneNumber.value) {
    tabs.push({
      value: phoneCallsTabIndex.value,
      label: t('navigation.phoneCall'),
      icon: 'mdi-phone-log-outline',
      disabled: !hasPersistedItem.value,
      disabledReason: supplementalDisabledReason.value,
    })
  }

  return tabs
})

const hasOpenedInformationTab = ref(false)
const hasOpenedDocumentsTab = ref(false)
const hasOpenedEmailsTab = ref(false)
const hasOpenedPhoneCallsTab = ref(false)

watch(
  [activeTab, supplementalTabs],
  ([tab, tabs]) => {
    if (
      typeof tab === 'number' &&
      tab > relationTemplates.value.length &&
      !tabs.some((supplementalTab) => supplementalTab.value === tab)
    ) {
      activeTab.value = 0
      return
    }

    if (tab === informationTabIndex.value) {
      hasOpenedInformationTab.value = true
    }
    if (tab === documentsTabIndex.value) {
      hasOpenedDocumentsTab.value = true
    }
    if (tab === emailsTabIndex.value) {
      hasOpenedEmailsTab.value = true
    }
    if (tab === phoneCallsTabIndex.value) {
      hasOpenedPhoneCallsTab.value = true
    }
  },
  { immediate: true },
)

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
  const dirtyChangeCount =
    dirtyFieldCount.value + dirtyRelationNames.value.length + (informationDirty.value ? 1 : 0)
  if (dirtyChangeCount <= 0) {
    return ''
  }

  return t('global.dirtyFieldCount', { count: dirtyChangeCount }, dirtyChangeCount)
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

function findFirstInvalidFieldShell(): HTMLElement | null {
  const invalidControl = formSurfaceRef.value?.querySelector<HTMLElement>(
    '[aria-invalid="true"], .v-input--error',
  )
  return invalidControl?.closest<HTMLElement>('[data-dialog-field-name]') ?? invalidControl ?? null
}

function focusInvalidField(fieldShell: HTMLElement): void {
  const focusTarget = fieldShell.matches(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]',
  )
    ? fieldShell
    : fieldShell.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]',
      )

  focusTarget?.focus({ preventScroll: true })
}

async function waitForValidationLayout(): Promise<void> {
  await nextTick()
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()))
  })
}

async function revealFirstInvalidField(): Promise<void> {
  activeTab.value = 0
  await nextTick()

  const initialFieldShell = findFirstInvalidFieldShell()
  if (!initialFieldShell) {
    return
  }

  const groupId =
    initialFieldShell.closest<HTMLElement>('[data-dialog-group-id]')?.dataset.dialogGroupId
  if (groupId && !isGroupExpanded(groupId)) {
    expandedGroupIds.value = [...expandedGroupIds.value, groupId]
  }

  await waitForValidationLayout()
  const fieldShell = findFirstInvalidFieldShell()
  if (!fieldShell) {
    return
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  fieldShell.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'center',
    inline: 'nearest',
  })
  focusInvalidField(fieldShell)
}

watch(validationFeedback, (feedback) => {
  if (feedback) {
    void revealFirstInvalidField()
  }
})

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
  if (props.mode === 'readonly' || hasFocusedCurrentOpenDialog.value) {
    return
  }

  hasFocusedCurrentOpenDialog.value = true
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
    if (!isOpen) {
      hasFocusedCurrentOpenDialog.value = false
      return
    }

    if (isOpen && !loading) {
      void focusFirstField()
    }
  },
)
// #endregion
</script>
