import { computed, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportBatchSummary } from '@/services/api.import.service'
import { useSaplingImportAiSuggestions } from '../useSaplingImportAiSuggestions'

const apiMocks = vi.hoisted(() => ({
  suggestBatchConfiguration: vi.fn(),
}))

vi.mock('@/services/api.import.service', () => ({
  default: apiMocks,
}))

describe('useSaplingImportAiSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.suggestBatchConfiguration.mockResolvedValue({
      mappings: [
        {
          sourceColumn: 'Company name',
          targetField: 'name',
          confidence: 0.92,
          reason: 'Exact label',
        },
        {
          sourceColumn: 'Missing',
          targetField: 'status',
          confidence: 0.5,
          reason: null,
        },
      ],
      externalKey: {
        columns: ['External ID', 'Missing'],
        confidence: 0.8,
        reason: null,
      },
      referenceFields: [],
      valueMappings: [
        {
          targetField: 'name',
          values: { Legacy: 'Current' },
          fallback: 'error',
          confidence: 0.7,
          reason: null,
        },
      ],
      warnings: [],
      providerHandle: 'openai',
      modelHandle: 'model',
    })
  })

  it('applies only context-valid field, key, and value suggestions', async () => {
    const fieldMappings = reactive<Record<string, string | null>>({ name: null, status: null })
    const externalKeyColumns = ref<string[]>([])
    const setValueMapping = vi.fn()
    const notifyCreated = vi.fn()
    const suggestions = useSaplingImportAiSuggestions({
      batch: ref({ handle: 9, filename: 'companies.csv' } as ImportBatchSummary),
      selectedEntityHandle: ref('company'),
      selectedSourceHandle: ref('erp'),
      headerOptions: computed(() => ['Company name', 'External ID']),
      fieldMappings,
      externalKeyColumns,
      filterExistingColumns: (columns) =>
        columns.filter((column) => ['Company name', 'External ID'].includes(column)),
      setValueMapping,
      notifyCreated,
      defaultReason: () => 'AI suggestion',
    })

    await suggestions.createAiSuggestion()

    expect(apiMocks.suggestBatchConfiguration).toHaveBeenCalledWith(9, {
      entityHandle: 'company',
      sourceHandle: 'erp',
    })
    expect(fieldMappings).toEqual({ name: 'Company name', status: null })
    expect(externalKeyColumns.value).toEqual(['External ID'])
    expect(setValueMapping).toHaveBeenCalledWith('name', { Legacy: 'Current' }, 'error')
    expect(suggestions.aiSuggestionReason('name')).toBe('Exact label')
    expect(suggestions.confidencePercent(0.92)).toBe('92%')
    expect(notifyCreated).toHaveBeenCalledOnce()
  })

  it('clears suggestion metadata independently per field', () => {
    const suggestions = useSaplingImportAiSuggestions({
      batch: ref(null),
      selectedEntityHandle: ref(null),
      selectedSourceHandle: ref(null),
      headerOptions: computed(() => []),
      fieldMappings: {},
      externalKeyColumns: ref([]),
      filterExistingColumns: (columns) => columns,
      setValueMapping: vi.fn(),
      notifyCreated: vi.fn(),
      defaultReason: () => 'AI suggestion',
    })
    suggestions.aiSuggestionFieldDetails.name = { confidence: 0.5, reason: null }

    suggestions.clearAiSuggestionFieldDetail('name')

    expect(suggestions.aiSuggestionFieldDetails).toEqual({})
    expect(suggestions.aiSuggestionReason('name')).toBe('AI suggestion')
  })
})
