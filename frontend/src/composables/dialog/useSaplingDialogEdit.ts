// #region Imports
import {
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  computed,
  nextTick,
  type ComputedRef,
  type Ref,
} from 'vue'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import { useI18n } from 'vue-i18n'
import type { SaplingGenericItem } from '@/entity/entity'
import { getDialogTemplateColumns } from '@/utils/saplingDialogLayoutUtil'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useSaplingDialogEditDirty } from './useSaplingDialogEditDirty'
import { useSaplingDialogEditForm } from './useSaplingDialogEditForm'
import { useSaplingDialogEditRelations } from './useSaplingDialogEditRelations'
import { useSaplingDialogEditReferences } from './useSaplingDialogEditReferences'
import { useSaplingDialogEditTemplates } from './useSaplingDialogEditTemplates'
import { useSaplingDialogEditActions } from './useSaplingDialogEditActions'
import {
  formatLocalDate,
  formatLocalTime,
  getItemHandle,
  getLocalDateTimeParts,
  hasFormValue,
  isValidDate,
  toUtcIsoString,
} from './saplingDialogEdit.utils'
import type {
  SaplingDialogEditEmit,
  UseSaplingDialogEditProps,
  VuetifyFormRef,
} from './saplingDialogEdit.types'
import { findSaplingDateRangePair, isSaplingDateRangeValid } from './saplingDateRangeValidation'
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
  let relationMutationRecordIdentity: string | null = null
  let relationMutationIdentitySkipsRemaining = 0
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

  function handlePersistedRelationMutation(item: SaplingGenericItem): void {
    relationMutationRecordIdentity = buildRecordIdentity(item)
    relationMutationIdentitySkipsRemaining = 2
    emit('update:item', item)
  }

  function consumeRelationMutationIdentity(identity: string): boolean {
    if (identity !== relationMutationRecordIdentity) {
      relationMutationRecordIdentity = null
      relationMutationIdentitySkipsRemaining = 0
      return false
    }

    relationMutationIdentitySkipsRemaining -= 1
    if (relationMutationIdentitySkipsRemaining <= 0) {
      relationMutationRecordIdentity = null
    }
    return true
  }

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
      onHydrated: autoSelectHydratedDependencies,
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
  })
  // #endregion

  function getTemplateColumnProps(template: EntityTemplate) {
    return getDialogTemplateColumns(template)
  }

  async function initialize() {
    isLoading.value = true

    try {
      await currentPersonStore.fetchCurrentPerson()
      await Promise.all([setEntitiesPermissions(), loadFormConfigs(), loadSystemTemplates()])
      await initializeRelationTables()
      await loadActiveRelationTableItems()
    } catch (error) {
      console.error('Error initializing dialog edit:', error)
    } finally {
      isLoading.value = false
      void nextTick(() => {
        void prefetchReferenceColumns(
          templates.value.filter(
            (template) => template.isReference && canReadReferenceEntity(template.referenceName),
          ),
        )
      })
    }
  }

  const requiredRule = (label: string) => (v: unknown) =>
    v !== null && v !== undefined && v !== '' ? true : `${label} ${t('global.isRequired')}`

  function isTemplateRequired(template: EntityTemplate): boolean {
    if (template.type === 'boolean' || template.formConfig?.renderer === 'boolean') {
      return false
    }

    if (template.formConfig?.required === true) {
      return true
    }

    if (template.formConfig?.required === false && template.nullable !== false) {
      return false
    }

    return template.isRequired === true
  }

  function isTemplateRecommended(template: EntityTemplate): boolean {
    if (
      template.type === 'boolean' ||
      template.formConfig?.renderer === 'boolean' ||
      isTemplateRequired(template)
    ) {
      return false
    }

    if (typeof template.formConfig?.recommended === 'boolean') {
      return template.formConfig.recommended
    }

    return template.options?.includes('isRecommended') === true
  }

  function isTemplateRecommendationActive(template: EntityTemplate): boolean {
    if (
      props.mode === 'readonly' ||
      !isTemplateRecommended(template) ||
      isFieldDisabled(template) ||
      hasFormValue(form.value[template.name])
    ) {
      return false
    }

    return !template.isReference || getReferenceAvailability(template) === 'available'
  }

  function getRecommendationMessage(template: EntityTemplate): string {
    const field = t(`${props.entity?.handle}.${template.name}`)
    return template.isReference
      ? t('global.recommendedReferenceAvailable', { field })
      : t('global.recommendedFieldMissing', { field })
  }

  function getRules(template: EntityTemplate): Array<(v: unknown) => true | string> {
    const rules: Array<(v: unknown) => true | string> = []
    if (isTemplateRequired(template)) {
      rules.push(requiredRule(t(`${props.entity?.handle}.${template.name}`)))
    }
    const dateRangePair = findSaplingDateRangePair(baseTemplates.value, template.name)
    if (dateRangePair) {
      rules.push(() =>
        isSaplingDateRangeValid(dateRangePair, form.value) ? true : t('global.invalidDateRange'),
      )
    }
    return rules
  }

  /**
   * Disables fields that must not be edited in the current dialog mode.
   */
  function isFieldDisabled(template: EntityTemplate): boolean {
    return (
      (template.name === 'handle' && props.mode !== 'create') ||
      (props.mode === 'create'
        ? template.fieldAccess?.allowInsert === false
        : props.mode === 'edit'
          ? template.fieldAccess?.allowUpdate === false
          : template.fieldAccess?.allowRead === false) ||
      template.options?.includes('isReadOnly') ||
      template.formConfig?.readonly === true ||
      props.mode === 'readonly'
    )
  }

  function isReferenceFieldDisabled(template: EntityTemplate): boolean {
    return isFieldDisabled(template) || isReferenceDependencyBlocked(template)
  }

  function applyReferenceTemplate(key: string, value: unknown): void {
    if (!value || typeof value !== 'object') {
      return
    }

    const template = visibleTemplates.value.find((entry) => entry.name === key)
    const mappings = template?.referenceTemplate?.mappings ?? []
    const source = value as Record<string, unknown>

    mappings.forEach((mapping) => {
      if (!mapping.sourceField || !mapping.targetField) {
        return
      }

      const nextValue = source[mapping.sourceField]
      if (nextValue === undefined || nextValue === null) {
        return
      }

      if (mapping.overwrite === false && hasFormValue(form.value[mapping.targetField])) {
        return
      }

      form.value[mapping.targetField] = nextValue
    })
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
    const dependencyTemplates = templates.value.filter((template) => template.referenceDependency)
    if (props.mode === 'create') {
      autoSelectSingleDependencies(dependencyTemplates)
    } else {
      dependencyTemplates
        .filter(isTemplateRecommended)
        .forEach((template) => void inspectRecommendedReference(template))
    }

    templates.value
      .filter(
        (template) =>
          template.isReference && !template.referenceDependency && isTemplateRecommended(template),
      )
      .forEach((template) => void inspectRecommendedReference(template))
  }

  async function loadActiveRelationTableItems(): Promise<void> {
    const activeRelationTemplate = relationTemplates.value[activeTab.value - 1]
    if (!activeRelationTemplate) {
      return
    }

    await ensureRelationTableItems(activeRelationTemplate.name)
  }

  function initializeFormWithParentContext(): void {
    initializeForm()
    syncParentReferences()
  }
  // #endregion

  // #region Lifecycle
  onMounted(initialize)

  // Warn the user before unloading the tab while the dialog has unsaved
  // changes. Browsers ignore the returned string nowadays but require the
  // `returnValue` assignment to trigger the native confirmation prompt.
  function onBeforeUnload(event: BeforeUnloadEvent): string | void {
    if (!isDirty.value || !props.modelValue) {
      return
    }
    event.preventDefault()
    event.returnValue = ''
    return ''
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    })
  }

  /**
   * Stable signature of the structural shape of `props.templates`.
   * Used to avoid `deep: true` watchers that fire on every nested mutation
   * (which used to re-trigger initialize/initializeForm/syncParentReferences
   * on every parent re-render and was a major cause of the dialog flickering
   * once relation tabs were active).
   */
  const templatesSignature = computed(() =>
    templates.value
      .map(
        (template) =>
          `${template.name}|${template.type ?? ''}|${template.kind ?? ''}|${template.referenceName ?? ''}|${template.options?.join(',') ?? ''}`,
      )
      .join('::'),
  )

  /**
   * Stable record identity. Relation tables only need to reset when we
   * actually switch to another record (entity handle + item handle) — not
   * every time the parent emits a fresh `props.item` reference with identical
   * content. The updatedAt segment lets successful saves and merges rehydrate
   * the form when the server returns a newer version for the same handle.
   */
  function normalizeRecordVersion(value: unknown): string {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString()
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    return ''
  }

  function buildRecordIdentity(item: SaplingGenericItem | null | undefined): string {
    return `${props.entity?.handle ?? ''}::${getItemHandle(item) ?? ''}::${props.mode}::${normalizeRecordVersion(item?.updatedAt)}`
  }

  const recordIdentity = computed(() => buildRecordIdentity(props.item))

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

  watch(() => currentPersonStore.person, applyCurrentDefaults)

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

  // #region Permissions
  async function setEntitiesPermissions() {
    const currentPermissionStore = useCurrentPermissionStore() // Access the current permission store
    await currentPermissionStore.fetchCurrentPermission() // Fetch current permissions
    permissions.value = currentPermissionStore.accumulatedPermission // Set the permissions
  }
  // #region

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
