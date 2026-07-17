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
// #endregion

/**
 * Encapsulates the full edit dialog workflow including initialization,
 * relation management and payload normalization before save.
 */
export function useSaplingDialogEdit(
  props: UseSaplingDialogEditProps,
  emit: SaplingDialogEditEmit,
  options?: { forceDirty?: ComputedRef<boolean>; forceDirtyFields?: ComputedRef<string[]> },
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

  const {
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
    selectedRelations,
    selectedItems,
    addRelation,
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
  } = useSaplingDialogEditRelations({
    entity: computed(() => props.entity),
    item: computed(() => props.item),
    mode: computed(() => props.mode),
    permissions,
    showReference,
    templates,
    t,
    getItemHandle,
  })

  const {
    extractDependencyIdentifier,
    getReferenceParentFilter,
    isReferenceDependencyBlocked,
    isReferenceValueValidForDependency,
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
    forceDirty: options?.forceDirty,
    forceDirtyFields: options?.forceDirtyFields,
    extractDependencyIdentifier,
    formatLocalDate,
    formatLocalTime,
    isValidDate,
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
    })

  const {
    pendingSaveAction,
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
    formRef,
    activeTab,
    emit,
    buildSavePayload,
    syncInitialFormSnapshot,
    resetRelationSelections,
    initializeFormWithParentContext,
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

  function getRules(template: EntityTemplate): Array<(v: unknown) => true | string> {
    const rules: Array<(v: unknown) => true | string> = []
    if (isTemplateRequired(template)) {
      rules.push(requiredRule(t(`${props.entity?.handle}.${template.name}`)))
    }
    return rules
  }

  /**
   * Disables fields that must not be edited in the current dialog mode.
   */
  function isFieldDisabled(template: EntityTemplate): boolean {
    return (
      (template.name === 'handle' && props.mode === 'edit') ||
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

  async function loadActiveRelationTableItems(): Promise<void> {
    if (props.mode === 'create') {
      return
    }

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

  const recordVersion = computed(() => normalizeRecordVersion(props.item?.updatedAt))

  const recordIdentity = computed(
    () =>
      `${props.entity?.handle ?? ''}::${getItemHandle(props.item) ?? ''}::${props.mode}::${recordVersion.value}`,
  )

  watch(recordIdentity, async (next, previous) => {
    if (next === previous) {
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

  watch(() => [recordIdentity.value, templatesSignature.value] as const, initializeForm, {
    immediate: true,
  })

  watch(
    () =>
      templates.value
        .filter((template) => template.referenceDependency)
        .map((template) => {
          const value = form.value[template.referenceDependency?.parentField ?? '']
          const identifier = extractDependencyIdentifier(value)
          return `${template.name}::${identifier ?? ''}`
        })
        .join('|'),
    () => {
      if (isHydratingForm.value) {
        return
      }

      templates.value
        .filter((template) => template.referenceDependency?.clearOnParentChange)
        .forEach((template) => {
          if (!isReferenceValueValidForDependency(template)) {
            form.value[template.name] = null
          }
        })
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
    isLoadingFormConfigs,
    selectFormConfig,
    getRules,
    getTemplateColumnProps,
    isTemplateDirty,
    getDirtyTemplateCount,
    isFieldDisabled,
    isReferenceFieldDisabled,
    getReferenceParentFilter,
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
    removeRelation,
    onRelationTablePage,
    onRelationTableItemsPerPage,
    onRelationTableSort,
    onRelationTableColumnFilters,
    onRelationTableReload,
  }
  // #endregion
}
