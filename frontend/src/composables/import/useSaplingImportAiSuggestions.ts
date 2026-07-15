import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue'
import ApiImportService, {
  type ImportAiSuggestion,
  type ImportBatchSummary,
  type ImportValueMappingFallback,
} from '@/services/api.import.service'

export type ImportAiSuggestionFieldDetail = {
  confidence: number
  reason: string | null
}

export interface SaplingImportAiSuggestionOptions {
  batch: Ref<ImportBatchSummary | null>
  selectedEntityHandle: Ref<string | null>
  selectedSourceHandle: Ref<string | null>
  headerOptions: ComputedRef<string[]>
  fieldMappings: Record<string, string | null>
  externalKeyColumns: Ref<string[]>
  filterExistingColumns: (columns: string[]) => string[]
  setValueMapping: (
    targetField: string,
    values: Record<string, unknown>,
    fallback: ImportValueMappingFallback,
  ) => void
  notifyCreated: (batch: ImportBatchSummary) => void
  defaultReason: () => string
}

export function useSaplingImportAiSuggestions(options: SaplingImportAiSuggestionOptions) {
  const isSuggesting = ref(false)
  const aiSuggestion = ref<ImportAiSuggestion | null>(null)
  const aiSuggestionFieldDetails = reactive<Record<string, ImportAiSuggestionFieldDetail>>({})

  const canSuggestWithAi = computed(
    () =>
      Boolean(options.batch.value?.handle && options.selectedEntityHandle.value) &&
      !isSuggesting.value,
  )

  async function createAiSuggestion(): Promise<void> {
    const currentBatch = options.batch.value
    const entityHandle = options.selectedEntityHandle.value
    if (!currentBatch?.handle || !entityHandle) {
      return
    }

    try {
      isSuggesting.value = true
      const suggestion = await ApiImportService.suggestBatchConfiguration(currentBatch.handle, {
        entityHandle,
        sourceHandle: options.selectedSourceHandle.value,
      })
      applyAiSuggestion(suggestion)
      options.notifyCreated(currentBatch)
    } catch {
      // Shared API errors already surface through the message center.
    } finally {
      isSuggesting.value = false
    }
  }

  function applyAiSuggestion(suggestion: ImportAiSuggestion): void {
    resetAiSuggestion()
    aiSuggestion.value = suggestion

    for (const mapping of suggestion.mappings) {
      if (
        !options.headerOptions.value.includes(mapping.sourceColumn) ||
        !(mapping.targetField in options.fieldMappings)
      ) {
        continue
      }
      options.fieldMappings[mapping.targetField] = mapping.sourceColumn
      aiSuggestionFieldDetails[mapping.targetField] = {
        confidence: mapping.confidence,
        reason: mapping.reason ?? null,
      }
    }

    if (options.selectedSourceHandle.value && suggestion.externalKey?.columns.length) {
      options.externalKeyColumns.value = options.filterExistingColumns(
        suggestion.externalKey.columns,
      )
    }

    for (const mapping of suggestion.valueMappings) {
      if (options.fieldMappings[mapping.targetField]) {
        options.setValueMapping(
          mapping.targetField,
          { ...(mapping.values ?? {}) },
          normalizeFallback(mapping.fallback),
        )
      }
    }
  }

  function clearAiSuggestionFieldDetail(targetField: string): void {
    delete aiSuggestionFieldDetails[targetField]
  }

  function resetAiSuggestion(): void {
    aiSuggestion.value = null
    Object.keys(aiSuggestionFieldDetails).forEach(clearAiSuggestionFieldDetail)
  }

  function aiSuggestionReason(targetField: string): string {
    return aiSuggestionFieldDetails[targetField]?.reason || options.defaultReason()
  }

  function confidencePercent(confidence: number): string {
    return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`
  }

  return {
    isSuggesting,
    aiSuggestion,
    aiSuggestionFieldDetails,
    canSuggestWithAi,
    createAiSuggestion,
    applyAiSuggestion,
    clearAiSuggestionFieldDetail,
    resetAiSuggestion,
    aiSuggestionReason,
    confidencePercent,
  }
}

function normalizeFallback(
  fallback: ImportValueMappingFallback | undefined,
): ImportValueMappingFallback {
  return fallback === 'empty' || fallback === 'error' ? fallback : 'keep'
}
