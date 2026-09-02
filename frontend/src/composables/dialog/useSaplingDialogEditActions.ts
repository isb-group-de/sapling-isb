import { computed, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import type { EntityItem, SaplingGenericItem } from '@/entity/entity'
import type { DialogSaveAction, DialogState } from '@/entity/structure'
import ApiGenericService from '@/services/api.generic.service'
import { isFormValid } from './saplingDialogEdit.utils'
import type {
  SaplingDialogEditEmit,
  SaplingDialogValidationFeedback,
  VuetifyFormRef,
} from './saplingDialogEdit.types'

export function useSaplingDialogEditActions({
  mode,
  entity,
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
  hasSupplementalChanges,
  persistSupplementalChanges,
  resetSupplementalChanges,
  clearDraft,
}: {
  mode: ComputedRef<DialogState>
  entity: ComputedRef<EntityItem | null>
  isDirty: ComputedRef<boolean>
  canSubmit: ComputedRef<boolean>
  formRef: Ref<VuetifyFormRef | null>
  activeTab: Ref<number>
  emit: SaplingDialogEditEmit
  buildSavePayload: () => SaplingGenericItem
  appendPendingRelationsToPayload: (payload: SaplingGenericItem) => SaplingGenericItem
  persistPendingRelations: (parentHandle: string | number) => Promise<boolean>
  syncInitialFormSnapshot: () => void
  resetRelationSelections: () => void
  initializeFormWithParentContext: () => void
  shouldPersistRecord?: ComputedRef<boolean>
  hasSupplementalChanges?: ComputedRef<boolean>
  persistSupplementalChanges?: () => Promise<boolean>
  resetSupplementalChanges?: () => void
  clearDraft?: () => void
}) {
  const pendingSaveAction = ref<DialogSaveAction | null>(null)
  const validationFeedback = ref<SaplingDialogValidationFeedback | null>(null)
  const unsavedChangesDialog = ref(false)
  const isSaving = computed(() => pendingSaveAction.value !== null)
  let validationAttempt = 0

  function completeSave(action?: DialogSaveAction): void {
    if (!action || pendingSaveAction.value === action) {
      pendingSaveAction.value = null
    }
  }

  async function waitForUiPaint(): Promise<void> {
    await nextTick()
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.setTimeout(resolve, 0))
    })
  }

  async function onDuplicateSelect(item: SaplingGenericItem): Promise<void> {
    if (!item || item.handle == null) return

    const fullItemResult = await ApiGenericService.find<SaplingGenericItem>(
      entity.value?.handle ?? '',
      {
        filter: { handle: item.handle },
        limit: 1,
        relations: ['m:1'],
      },
    )
    clearDraft?.()
    emit('update:mode', 'edit')
    emit('update:modelValue', true)
    emit('update:item', fullItemResult.data[0] ?? null)
  }

  async function prepareSubmit(action: DialogSaveAction): Promise<SaplingGenericItem | null> {
    if (!canSubmit.value || isSaving.value) return null

    validationFeedback.value = null
    pendingSaveAction.value = action
    await waitForUiPaint()
    const result = await formRef.value?.validate()
    if (!isFormValid(result)) {
      completeSave(action)
      validationAttempt += 1
      validationFeedback.value = { action, attempt: validationAttempt }
      return null
    }
    return appendPendingRelationsToPayload(buildSavePayload())
  }

  function emitSave(output: SaplingGenericItem, action: DialogSaveAction): void {
    emit('save', output, action, {
      persistPendingRelations,
      complete: (didSave = true) => {
        completeSave(action)
        if (didSave) {
          clearDraft?.()
          syncInitialFormSnapshot()
        }
      },
    })
  }

  async function saveWithAction(action: DialogSaveAction): Promise<void> {
    if (!canSubmit.value || isSaving.value) return

    const persistRecord = shouldPersistRecord?.value ?? true
    let output: SaplingGenericItem | null = null

    if (persistRecord) {
      output = await prepareSubmit(action)
      if (!output) return
    } else {
      validationFeedback.value = null
      pendingSaveAction.value = action
      await waitForUiPaint()
    }

    if (hasSupplementalChanges?.value) {
      const didSaveSupplementalChanges = (await persistSupplementalChanges?.()) ?? false
      if (!didSaveSupplementalChanges) {
        completeSave(action)
        return
      }
    }

    if (output) {
      emitSave(output, action)
      return
    }

    completeSave(action)
    if (action === 'saveAndClose') {
      closeDialog()
    }
  }

  function resetForm(): void {
    if (!isDirty.value) return
    validationFeedback.value = null
    clearDraft?.()
    resetRelationSelections()
    resetSupplementalChanges?.()
    activeTab.value = 0
    initializeFormWithParentContext()
    void nextTick(() => formRef.value?.resetValidation?.())
  }

  function closeDialog(): void {
    clearDraft?.()
    pendingSaveAction.value = null
    validationFeedback.value = null
    unsavedChangesDialog.value = false
    emit('update:modelValue', false)
    emit('cancel')
  }

  function cancel(): void {
    if (mode.value !== 'readonly' && isDirty.value && !isSaving.value) {
      unsavedChangesDialog.value = true
      return
    }
    closeDialog()
  }

  function handleDialogUpdate(value: boolean): void {
    if (value) {
      emit('update:modelValue', true)
      return
    }
    cancel()
  }

  function keepEditing(): void {
    unsavedChangesDialog.value = false
  }

  function discardChanges(): void {
    resetForm()
    closeDialog()
  }

  async function saveChangesAndClose(): Promise<void> {
    unsavedChangesDialog.value = false
    await saveWithAction('saveAndClose')
  }

  return {
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
    save: () => saveWithAction('save'),
    saveAndClose: () => saveWithAction('saveAndClose'),
  }
}
