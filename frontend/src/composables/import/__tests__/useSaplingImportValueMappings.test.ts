import { computed, reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import ApiImportService, {
  type ImportBatchSourceValues,
  type ImportBatchSummary,
} from '@/services/api.import.service'
import {
  normalizeImportValueMappingKey,
  useSaplingImportValueMappings,
} from '../useSaplingImportValueMappings'

describe('useSaplingImportValueMappings', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createValueMappings() {
    const clearAiSuggestionFieldDetail = vi.fn()
    const fieldMappings = reactive<Record<string, string | null>>({
      name: 'Name',
      city: 'Name',
    })
    const valueMappings = useSaplingImportValueMappings({
      batch: ref(null),
      importableFields: computed(
        () =>
          [
            { name: 'name', type: 'string' },
            { name: 'city', type: 'string' },
          ] as EntityTemplate[],
      ),
      fieldMappings,
      clearAiSuggestionFieldDetail,
      fieldLabel: (targetField) => `field:${targetField}`,
      usedLabel: () => 'Used',
    })

    return { clearAiSuggestionFieldDetail, fieldMappings, ...valueMappings }
  }

  it('centralizes source-column display and usage information', () => {
    const mappings = createValueMappings()

    expect(mappings.getSourceColumnOptionValue({ raw: 'Name' })).toBe('Name')
    expect(mappings.getSourceColumnOptionTitle({ value: 'Name' })).toBe('Name')
    expect(mappings.sourceColumnUsageLabels('Name')).toEqual(['field:name', 'field:city'])
    expect(mappings.sourceColumnUsageSummary('Name')).toBe('Used 2x')
    expect(normalizeImportValueMappingKey(' 42 ')).toBe('42')
  })

  it('owns dialog updates and resets all value-mapping state', () => {
    const mappings = createValueMappings()
    mappings.valueMappings.name = {
      targetField: 'name',
      values: {},
      fallback: 'keep',
    }
    mappings.valueMappingDialog.targetField = 'name'
    mappings.valueMappingDialog.visible = true

    mappings.updateCurrentValueMappingFallback('error')
    mappings.updateCurrentValueMappingValue('Legacy', 'Current')
    mappings.onFieldMappingChange('city')

    expect(mappings.valueMappings.name).toMatchObject({
      fallback: 'error',
      values: { Legacy: 'Current' },
    })
    expect(mappings.clearAiSuggestionFieldDetail).toHaveBeenCalledWith('city')

    mappings.resetValueMappings()

    expect(mappings.valueMappings).toEqual({})
    expect(mappings.valueMappingDialog).toMatchObject({ visible: false, targetField: null })
  })

  it('opens immediately while source values are loading', async () => {
    let resolveSourceValues: ((value: ImportBatchSourceValues) => void) | undefined
    vi.spyOn(ApiImportService, 'getBatchSourceValues').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSourceValues = resolve
      }),
    )
    const batch = {
      handle: 7,
      rows: [],
      sampleRows: [],
    } as unknown as ImportBatchSummary
    const state = useSaplingImportValueMappings({
      batch: ref(batch),
      importableFields: computed(() => [{ name: 'name', type: 'string' }] as EntityTemplate[]),
      fieldMappings: reactive({ name: 'Name' }),
      clearAiSuggestionFieldDetail: vi.fn(),
      fieldLabel: (targetField) => targetField,
      usedLabel: () => 'Used',
    })

    const opening = state.openValueMapping({ name: 'name', type: 'string' } as EntityTemplate)

    expect(state.valueMappingDialog).toMatchObject({
      visible: true,
      targetField: 'name',
      loading: true,
    })

    resolveSourceValues?.({ values: ['Legacy'], isTruncated: false })
    await opening

    expect(state.valueMappingDialog.loading).toBe(false)
    expect(state.currentValueMappingSourceValues.value).toEqual(['Legacy'])
  })

  it('keeps the dialog open with batch values when loading source values fails', async () => {
    vi.spyOn(ApiImportService, 'getBatchSourceValues').mockRejectedValueOnce(
      new Error('Source values unavailable'),
    )
    const batch = {
      handle: 8,
      rows: [],
      sampleRows: [{ Name: 'Fallback' }],
    } as unknown as ImportBatchSummary
    const state = useSaplingImportValueMappings({
      batch: ref(batch),
      importableFields: computed(() => [{ name: 'name', type: 'string' }] as EntityTemplate[]),
      fieldMappings: reactive({ name: 'Name' }),
      clearAiSuggestionFieldDetail: vi.fn(),
      fieldLabel: (targetField) => targetField,
      usedLabel: () => 'Used',
    })

    await state.openValueMapping({ name: 'name', type: 'string' } as EntityTemplate)

    expect(state.valueMappingDialog).toMatchObject({
      visible: true,
      targetField: 'name',
      loading: false,
    })
    expect(state.currentValueMappingSourceValues.value).toEqual(['Fallback'])
  })
})
