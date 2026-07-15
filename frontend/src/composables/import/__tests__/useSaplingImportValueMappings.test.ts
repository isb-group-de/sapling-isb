import { computed, reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  normalizeImportValueMappingKey,
  useSaplingImportValueMappings,
} from '../useSaplingImportValueMappings'

describe('useSaplingImportValueMappings', () => {
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
})
