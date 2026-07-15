import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ImportTemplateSummary } from '@/services/api.import.service'
import { useSaplingImportConfigurationSession } from '@/composables/import/useSaplingImportConfigurationSession'

function setup() {
  const selectedEntityHandle = ref<string | null>('company')
  const selectedSourceHandle = ref<string | null>('erp')
  const externalKeyColumns = ref(['External Id'])
  const genericReferenceEntityHandle = ref<string | null>('person')
  const genericReferenceKeyColumns = ref(['Person Id'])
  const callbacks = {
    initializeMappingConfiguration: vi.fn(),
    clearMappingConfiguration: vi.fn(),
    applyMappingConfiguration: vi.fn(),
    filterExistingColumns: vi.fn((columns: string[]) =>
      columns.filter((column) => column !== 'Missing'),
    ),
    normalizeExternalColumns: vi.fn((columns: string[]) =>
      Array.from(new Set(columns.map((column) => column.trim()).filter(Boolean))),
    ),
    buildFieldMappings: vi.fn(() => [{ targetField: 'name', sourceColumn: 'Name' }]),
    buildFieldDefaults: vi.fn(() => []),
    buildRelationMappings: vi.fn(() => []),
    buildValueMappings: vi.fn(() => []),
    buildUniqueConflictStrategies: vi.fn(() => []),
    resetAiSuggestion: vi.fn(),
    resetValueMappings: vi.fn(),
    getSelectedTemplateHandle: vi.fn(() => 11),
    getTemplateTitle: vi.fn(() => ' CRM import '),
  }
  const session = useSaplingImportConfigurationSession({
    selectedEntityHandle,
    selectedSourceHandle,
    externalKeyColumns,
    genericReferenceEntityHandle,
    genericReferenceKeyColumns,
    hasGenericReference: computed(() => true),
    ...callbacks,
  })
  return {
    session,
    callbacks,
    externalKeyColumns,
    genericReferenceEntityHandle,
    genericReferenceKeyColumns,
  }
}

describe('useSaplingImportConfigurationSession', () => {
  it('coordinates resets and applies a reusable template configuration', () => {
    const state = setup()
    const template = {
      mapping: { mappings: [{ targetField: 'name', sourceColumn: 'Name' }] },
      externalKeyColumns: ['External Id', 'Missing'],
      genericReferenceMapping: {
        entityHandle: 'person',
        sourceHandle: 'erp',
        keyColumns: ['Person Id', 'Missing'],
      },
    } as ImportTemplateSummary

    state.session.initializeMappings()
    state.session.clearMappingState()
    state.session.applyTemplate(template)

    expect(state.callbacks.initializeMappingConfiguration).toHaveBeenCalled()
    expect(state.callbacks.clearMappingConfiguration).toHaveBeenCalled()
    expect(state.callbacks.resetAiSuggestion).toHaveBeenCalledTimes(3)
    expect(state.callbacks.resetValueMappings).toHaveBeenCalledTimes(2)
    expect(state.callbacks.applyMappingConfiguration).toHaveBeenCalledWith(template.mapping)
    expect(state.externalKeyColumns.value).toEqual(['External Id'])
    expect(state.genericReferenceKeyColumns.value).toEqual(['Person Id'])
  })

  it('builds the complete API template payload including generic references', () => {
    const state = setup()

    expect(state.session.buildTemplatePayload()).toEqual({
      entityHandle: 'company',
      sourceHandle: 'erp',
      templateHandle: 11,
      keyColumns: ['External Id'],
      mappings: [{ targetField: 'name', sourceColumn: 'Name' }],
      fieldDefaults: [],
      relationMappings: [],
      valueMappings: [],
      uniqueConflictStrategies: [],
      genericReferenceMapping: {
        entityHandle: 'person',
        sourceHandle: 'erp',
        keyColumns: ['Person Id'],
      },
      title: 'CRM import',
    })
  })
})
