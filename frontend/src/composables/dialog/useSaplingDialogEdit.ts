// #region Imports
import { ref, watch, onMounted, computed, nextTick, type ComputedRef, type Ref } from 'vue'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import { getDialogTemplateColumns } from '@/utils/saplingDialogLayoutUtil'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingDialogEditDirty } from './useSaplingDialogEditDirty'
import { useSaplingDialogEditForm } from './useSaplingDialogEditForm'
import { useSaplingDialogEditRelations } from './useSaplingDialogEditRelations'
import { useSaplingDialogEditReferences } from './useSaplingDialogEditReferences'
import { useSaplingDialogEditTemplates } from './useSaplingDialogEditTemplates'
import { useSaplingDialogEditActions } from './useSaplingDialogEditActions'
import { useSaplingDialogEditDraft } from './useSaplingDialogEditDraft'
import {
  formatLocalDate,
  formatLocalTime,
  applyReferenceTemplateMappings,
  buildDialogRecordIdentity,
  buildDialogTemplatesSignature,
  getItemHandle,
  getLocalDateTimeParts,
  hasFormValue,
  isValidDate,
  runReferenceHydrationAutomation,
  toUtcIsoString,
} from './saplingDialogEdit.utils'
import type {
  SaplingDialogEditEmit,
  UseSaplingDialogEditProps,
  VuetifyFormRef,
} from './saplingDialogEdit.types'
import { useSaplingDialogEditFieldRules } from './useSaplingDialogEditFieldRules'
import {
  initializeSaplingDialogEdit,
  initializeDialogFormWithParentContext,
  loadActiveDialogRelation,
  loadSaplingDialogPermissions,
  useSaplingDialogBeforeUnloadGuard,
} from './useSaplingDialogEditLifecycle'
import { createDialogRelationMutationIdentityTracker } from './saplingDialogRelationMutationIdentity'
// #endregion

/**
 * Encapsulates the full edit dialog workflow including initialization,
 * relation management and payload normalization before save.
 */
export function useSaplingDialogEdit(
  props: UseSaplingDialogEditProps,
  emit: SaplingDialogEditEmit,
  options?: {
    forceDirty?: ComputedRef<boolean>
    forceDirtyFields?: ComputedRef<string[]>
    allowPristineCreate?: ComputedRef<boolean>
    hasSupplementalChanges?: ComputedRef<boolean>
    persistSupplementalChanges?: () => Promise<boolean>
    resetSupplementalChanges?: () => void
  },
) {
  // #region State
  const { t, te } = useI18n()
  const showReference = computed(() => props.showReference !== false)
  const isLoading = ref(true)
  const form: Ref<SaplingGenericItem> = ref({})
  const formRef: Ref<VuetifyFormRef | null> = ref(null)
  const activeTab = ref(0)
  const permissions = ref<AccumulatedPermission[] | null>(null)
  const currentPersonStore = useCurrentPersonStore()
  const isHydratingForm = ref(false)
  const initialFormSnapshot = ref<Record<string, string>>({})
  // #endregion

  // #region Helpers
  const {
    baseTemplates,
    templates,
    visibleTemplates,
    visibleTemplateGroups,
    formConfigMenuItems,
    selectedFormConfigLabel,
    isLoadingFormConfigs,
    iconNames,
    selectDefaultFormConfig,
    selectFormConfig,
    loadFormConfigs,
    loadSystemTemplates,
    resetTemplateSources,
  } = useSaplingDialogEditTemplates({
    entity: computed(() => props.entity),
    mode: computed(() => props.mode),
    providedTemplates: computed(() => props.templates ?? []),
    showReference,
    permissions,
    activeTab,
    t,
    te,
  })

  // #region Templates

  const { consumeRelationMutationIdentity, handlePersistedRelationMutation } =
    createDialogRelationMutationIdentityTracker({
      buildIdentity: (item) => buildDialogRecordIdentity(props.entity?.handle, item, props.mode),
      onPersistedItem: (item) => emit('update:item', item),
    })

  const {
    relationTemplates,
    dirtyRelationNames,
    hasPendingRelationChanges,
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
    selectedRelations,
    selectedItems,
    addRelation,
    stageNewRelationRecord,
    removeRelation,
    initializeRelationTables,
    ensureRelationTableItems,
    onRelationTablePage,
    onRelationTableItemsPerPage,
    onRelationTableSort,
    onRelationTableColumnFilters,
    onRelationTableReload,
    clearSelectedItems,
    resetRelationTableItems,
    resetRelationSelections,
    appendPendingRelationsToPayload,
    persistPendingRelations,
  } = useSaplingDialogEditRelations({
    entity: computed(() => props.entity),
    item: computed(() => props.item),
    mode: computed(() => props.mode),
    permissions,
    showReference,
    templates,
    t,
    getItemHandle,
    onPersistedItemUpdated: handlePersistedRelationMutation,
  })

  const relationAwareForceDirty = computed(
    () =>
      options?.forceDirty?.value === true ||
      hasPendingRelationChanges.value ||
      options?.hasSupplementalChanges?.value === true,
  )

  const {
    extractDependencyIdentifier,
    getReferenceParentFilter,
    isReferenceDependencyBlocked,
    isReferenceValueValidForDependency,
    applyReferenceDependencyParent,
    findSingleReferenceForDependency,
    inspectRecommendedReference,
    getReferenceAvailability,
    getReferenceColumnsSync,
    canReadReferenceEntity,
    prefetchReferenceColumns,
    fetchReferenceData,
  } = useSaplingDialogEditReferences({
    form,
    templates,
    permissions,
    hasFormValue,
  })

  const {
    syncInitialFormSnapshot,
    isDirty,
    dirtyFieldCount,
    isTemplateDirty,
    getDirtyTemplateCount,
  } = useSaplingDialogEditDirty({
    form,
    templates,
    initialFormSnapshot,
    forceDirty: relationAwareForceDirty,
    forceDirtyFields: options?.forceDirtyFields,
    extractDependencyIdentifier,
    formatLocalDate,
    formatLocalTime,
    isValidDate,
  })
  const canSubmit = computed(
    () =>
      isDirty.value || (props.mode === 'create' && options?.allowPristineCreate?.value === true),
  )
  const shouldPersistRecord = computed(
    () =>
      options?.forceDirty?.value === true ||
      hasPendingRelationChanges.value ||
      dirtyFieldCount.value > 0 ||
      (props.mode === 'create' && options?.allowPristineCreate?.value === true),
  )

  const { restoreDraft, clearDraft } = useSaplingDialogEditDraft({
    form,
    templates,
    mode: computed(() => props.mode),
    entity: computed(() => props.entity),
    item: computed(() => props.item),
    parent: computed(() => props.parent),
    parentEntity: computed(() => props.parentEntity),
    person: computed(() => currentPersonStore.person),
    modelValue: computed(() => props.modelValue),
    isDirty,
    isHydratingForm,
  })

  const { applyCurrentDefaults, initializeForm, syncParentReferences, buildSavePayload } =
    useSaplingDialogEditForm({
      form,
      templates,
      mode: computed(() => props.mode),
      item: computed(() => props.item),
      parent: computed(() => props.parent),
      parentEntity: computed(() => props.parentEntity),
      relationTemplates,
      currentPerson: computed(() => currentPersonStore.person),
      isHydratingForm,
      isLoading,
      initialFormSnapshot,
      hasFormValue,
      syncInitialFormSnapshot,
      formatLocalDate,
      formatLocalTime,
      getLocalDateTimeParts,
      toUtcIsoString,
      onHydrated: () => {
        restoreDraft()
        autoSelectHydratedDependencies()
      },
    })

  const {
    pendingSaveAction,
    validationFeedback,
    unsavedChangesDialog,
    isSaving,
    completeSave,
    onDuplicateSelect,
    handleDialogUpdate,
    cancel,
    keepEditing,
    discardChanges,
    saveChangesAndClose,
    resetForm,
    save,
    saveAndClose,
  } = useSaplingDialogEditActions({
    mode: computed(() => props.mode),
    entity: computed(() => props.entity),
    isDirty,
    canSubmit,
    formRef,
    activeTab,
    emit,
    buildSavePayload,
    appendPendingRelationsToPayload,
    persistPendingRelations,
    syncInitialFormSnapshot,
    resetRelationSelections,
    initializeFormWithParentContext,
    shouldPersistRecord,
    hasSupplementalChanges: options?.hasSupplementalChanges,
    persistSupplementalChanges: options?.persistSupplementalChanges,
    resetSupplementalChanges: options?.resetSupplementalChanges,
    clearDraft,
  })
  // #endregion

  const getTemplateColumnProps = getDialogTemplateColumns

  async function initialize() {
    await initializeSaplingDialogEdit({
      isLoading,
      load: async () => {
        await currentPersonStore.fetchCurrentPerson()
        await Promise.all([
          loadSaplingDialogPermissions(permissions),
          loadFormConfigs(),
          loadSystemTemplates(),
        ])
        await initializeRelationTables()
        await loadActiveRelationTableItems()
      },
      afterLoad: () =>
        void nextTick(() => {
          void prefetchReferenceColumns(
            templates.value.filter(
              (template) => template.isReference && canReadReferenceEntity(template.referenceName),
            ),
          )
        }),
      onError: (error) => console.error('Error initializing dialog edit:', error),
    })
  }

  const {
    getRecommendationMessage,
    getRules,
    isFieldDisabled,
    isReferenceFieldDisabled,
    isTemplateRecommendationActive,
    isTemplateRecommended,
  } = useSaplingDialogEditFieldRules({
    mode: () => props.mode,
    entityHandle: () => props.entity?.handle,
    form,
    baseTemplates,
    translate: (key, params) => t(key, params ?? {}),
    getReferenceAvailability,
    isReferenceDependencyBlocked,
  })

  function applyReferenceTemplate(key: string, value: unknown): void {
    const template = visibleTemplates.value.find((entry) => entry.name === key)
    applyReferenceTemplateMappings(template, value, form.value)
  }

  function updateFormField(key: string, value: unknown): void {
    form.value[key] = value
    applyReferenceDependencyParent(key, value)
    applyReferenceTemplate(key, value)

    const template = templates.value.find((entry) => entry.name === key)
    if (template?.isReference && isTemplateRecommended(template) && !hasFormValue(value)) {
      void inspectRecommendedReference(template)
    }
  }

  function autoSelectSingleDependencies(dependencyTemplates: EntityTemplate[]): void {
    dependencyTemplates.forEach((template) => {
      void findSingleReferenceForDependency(template).then((singleReference) => {
        if (singleReference && !isReferenceFieldDisabled(template)) {
          updateFormField(template.name, singleReference)
        }
      })
    })
  }

  function autoSelectHydratedDependencies(): void {
    runReferenceHydrationAutomation({
      templates: templates.value,
      mode: props.mode,
      autoSelect: autoSelectSingleDependencies,
      inspectRecommended: (template) => void inspectRecommendedReference(template),
      isRecommended: isTemplateRecommended,
    })
  }

  async function loadActiveRelationTableItems(): Promise<void> {
    await loadActiveDialogRelation(
      relationTemplates.value,
      activeTab.value,
      ensureRelationTableItems,
    )
  }

  function initializeFormWithParentContext(): void {
    initializeDialogFormWithParentContext(initializeForm, syncParentReferences)
  }
  // #endregion

  // #region Lifecycle
  onMounted(initialize)

  useSaplingDialogBeforeUnloadGuard(() => isDirty.value && props.modelValue)

  /**
   * Stable signature of the structural shape of `props.templates`.
   * Used to avoid `deep: true` watchers that fire on every nested mutation
   * (which used to re-trigger initialize/initializeForm/syncParentReferences
   * on every parent re-render and was a major cause of the dialog flickering
   * once relation tabs were active).
   */
  const templatesSignature = computed(() => buildDialogTemplatesSignature(templates.value))

  /**
   * Stable record identity. Relation tables only need to reset when we
   * actually switch to another record (entity handle + item handle) — not
   * every time the parent emits a fresh `props.item` reference with identical
   * content. The updatedAt segment lets successful saves and merges rehydrate
   * the form when the server returns a newer version for the same handle.
   */
  const recordIdentity = computed(() =>
    buildDialogRecordIdentity(props.entity?.handle, props.item, props.mode),
  )

  watch(recordIdentity, async (next, previous) => {
    if (next === previous) {
      return
    }

    if (consumeRelationMutationIdentity(next)) {
      return
    }

    clearSelectedItems()
    resetRelationTableItems()
    await loadActiveRelationTableItems()
  })

  watch(activeTab, () => {
    void loadActiveRelationTableItems()
  })

  watch(
    () => props.entity?.handle ?? '',
    () => {
      resetTemplateSources()
    },
  )

  watch(templatesSignature, async () => {
    await initialize()
  })

  watch(
    () => [recordIdentity.value, templatesSignature.value] as const,
    ([identity]) => {
      if (consumeRelationMutationIdentity(identity)) {
        return
      }
      initializeForm()
    },
    { immediate: true },
  )

  watch(
    () =>
      Object.fromEntries(
        templates.value
          .filter((template) => template.referenceDependency)
          .map((template) => {
            const value = form.value[template.referenceDependency?.parentField ?? '']
            const identifier = extractDependencyIdentifier(value)
            return [template.name, JSON.stringify(identifier)]
          }),
      ),
    (nextParentSignatures, previousParentSignatures) => {
      if (isHydratingForm.value) {
        return
      }

      const dependencyTemplates = templates.value.filter(
        (template) =>
          template.referenceDependency &&
          nextParentSignatures[template.name] !== previousParentSignatures?.[template.name],
      )

      dependencyTemplates
        .filter((template) => template.referenceDependency?.clearOnParentChange)
        .forEach((template) => {
          if (!isReferenceValueValidForDependency(template)) {
            form.value[template.name] = null
          }
        })

      autoSelectSingleDependencies(dependencyTemplates)
    },
  )

  watch(
    () => currentPersonStore.person,
    () => {
      applyCurrentDefaults()
      if (props.modelValue && !isHydratingForm.value) {
        restoreDraft()
      }
    },
  )

  watch(
    () => [props.parent, props.parentEntity, props.mode, templatesSignature.value] as const,
    syncParentReferences,
    {
      immediate: true,
    },
  )

  watch(isDirty, (dirty) => {
    if (!dirty) {
      completeSave()
    }
  })

  watch(
    () => props.modelValue,
    (visible) => {
      if (visible) {
        selectDefaultFormConfig()
        initializeFormWithParentContext()
        return
      }

      completeSave()
    },
  )
  // #endregion

  // #region Return
  return {
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
    isLoadingFormConfigs,
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
    getReferenceColumnsSync,
    fetchReferenceData,
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
  }
  // #endregion
}
