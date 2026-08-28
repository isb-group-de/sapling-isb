import { computed, ref, watch, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService, {
  type GenericDeleteImpact,
  type GenericDeleteReference,
} from '@/services/api.generic.service'

export interface SaplingDeleteConfirmation {
  cascadeRelations: string[]
}

type SaplingDialogDeleteEmit = {
  (event: 'update:modelValue', value: boolean): void
  (event: 'confirm', value: SaplingDeleteConfirmation): void
  (event: 'cancel'): void
}

interface SaplingDialogDeleteOptions {
  modelValue: Ref<boolean>
  item: Ref<SaplingGenericItem | SaplingGenericItem[] | null>
  entityHandle: Ref<string | undefined>
}

const DEFAULT_IMPACT: GenericDeleteImpact = { action: 'delete', references: [] }

/** Owns delete-impact loading and the optional owned-reference selection. */
export function useSaplingDialogDelete(
  options: SaplingDialogDeleteOptions,
  emit: SaplingDialogDeleteEmit,
) {
  const impact = ref<GenericDeleteImpact>(DEFAULT_IMPACT)
  const isImpactLoading = ref(false)
  const selectedReferenceNames = ref<string[]>([])
  let impactRequestId = 0

  const isBulkDelete = computed(() => Array.isArray(options.item.value))
  const isCancelAction = computed(() => impact.value.action === 'cancel')
  const referenceOptions = computed<GenericDeleteReference[]>(() => impact.value.references)
  const optionalReferenceOptions = computed(() =>
    referenceOptions.value.filter((reference) => !reference.required),
  )
  const hasReferenceOptions = computed(
    () => referenceOptions.value.length > 0 && !isCancelAction.value,
  )
  const hasOptionalReferenceOptions = computed(
    () => optionalReferenceOptions.value.length > 0 && !isCancelAction.value,
  )
  const allReferencesSelected = computed(
    () =>
      hasOptionalReferenceOptions.value &&
      selectedReferenceNames.value.length === optionalReferenceOptions.value.length,
  )

  function handleDialogUpdate(value: boolean): void {
    emit('update:modelValue', value)
  }

  function handleCancel(): void {
    resetSelection()
    emit('update:modelValue', false)
    emit('cancel')
  }

  function handleConfirm(): void {
    closeAndConfirm([...selectedReferenceNames.value])
  }

  function selectAllReferences(): void {
    selectedReferenceNames.value = optionalReferenceOptions.value.map((reference) => reference.name)
  }

  function clearReferenceSelection(): void {
    selectedReferenceNames.value = []
  }

  function closeAndConfirm(cascadeRelations: string[]): void {
    resetSelection()
    emit('update:modelValue', false)
    emit('confirm', { cascadeRelations })
  }

  function resetSelection(): void {
    clearReferenceSelection()
  }

  async function loadImpact(): Promise<void> {
    const entityHandle = options.entityHandle.value?.trim()
    const handle = getImpactItemHandle(options.item.value)
    const requestId = ++impactRequestId
    resetSelection()
    impact.value = DEFAULT_IMPACT
    isImpactLoading.value = false

    if (!options.modelValue.value || !entityHandle || handle == null) return

    isImpactLoading.value = true
    try {
      const result = await ApiGenericService.getDeleteImpact(entityHandle, handle)
      if (requestId === impactRequestId) {
        impact.value = isBulkDelete.value
          ? {
              action: 'delete',
              references: result.references.filter((reference) => reference.required),
            }
          : result
      }
    } catch {
      // The normal delete action remains available; the backend still enforces its strategy.
    } finally {
      if (requestId === impactRequestId) isImpactLoading.value = false
    }
  }

  watch(
    () => [options.modelValue.value, options.entityHandle.value, options.item.value] as const,
    ([isOpen]) => {
      if (isOpen) {
        void loadImpact()
      } else {
        impactRequestId += 1
        isImpactLoading.value = false
        impact.value = DEFAULT_IMPACT
        resetSelection()
      }
    },
    { immediate: true },
  )

  return {
    allReferencesSelected,
    clearReferenceSelection,
    handleCancel,
    handleConfirm,
    handleDialogUpdate,
    hasReferenceOptions,
    hasOptionalReferenceOptions,
    isCancelAction,
    isImpactLoading,
    referenceOptions,
    selectAllReferences,
    selectedReferenceNames,
  }
}

function getImpactItemHandle(
  item: SaplingGenericItem | SaplingGenericItem[] | null,
): string | number | null {
  const impactItem = Array.isArray(item) ? item[0] : item
  if (!impactItem) return null
  const handle = impactItem.handle
  return typeof handle === 'string' || typeof handle === 'number' ? handle : null
}
