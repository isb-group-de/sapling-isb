import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { ImportBatchSummary, ImportTemplateSummary } from '@/services/api.import.service'
import { useSaplingImportBatchSession } from '@/composables/import/useSaplingImportBatchSession'

function setup() {
  const batch = ref<ImportBatchSummary | null>(null)
  const selectedFile = ref<File | File[] | null>(null)
  const selectedOpenBatchRecord = ref<SaplingGenericItem | null>(null)
  const selectedTargetEntityRecord = ref<SaplingGenericItem | null>(null)
  const selectedSourceRecord = ref<SaplingGenericItem | null>(null)
  const selectedEntityHandle = ref<string | null>(null)
  const selectedSourceHandle = ref<string | null>(null)
  const externalKeyColumns = ref<string[]>([])
  const genericReferenceEntityHandle = ref<string | null>(null)
  const genericReferenceKeyColumns = ref<string[]>([])
  const selectedTemplateHandle = ref<number | string | null>(null)
  const selectedTemplateRecord = ref<SaplingGenericItem | null>(null)
  const selectedTemplateSummary = ref<ImportTemplateSummary | null>(null)
  const selectedTemplate = computed(() => selectedTemplateSummary.value)
  const templateTitle = ref('')
  const isApplyingTemplate = ref(false)
  const template = {
    handle: 11,
    title: 'CRM import',
    mapping: { mappings: [{ targetField: 'name', sourceColumn: 'Name' }] },
  } as ImportTemplateSummary
  const callbacks = {
    clearSelectedTemplate: vi.fn(),
    selectTemplateRecord: vi.fn(() => Promise.resolve()),
    loadSelectedTemplateSummary: vi.fn(() => Promise.resolve(template)),
    loadEntityMetadata: vi.fn(() => Promise.resolve()),
    loadTranslations: vi.fn(() => Promise.resolve()),
    initializeMappings: vi.fn(),
    clearMappingState: vi.fn(),
    applyMappingConfiguration: vi.fn(),
    filterExistingColumns: vi.fn((columns: string[]) =>
      columns.filter((column) => column !== 'Missing'),
    ),
    startBatchPolling: vi.fn(),
    trackImportBatch: vi.fn(),
    notifyBatchLoaded: vi.fn(),
  }

  const session = useSaplingImportBatchSession({
    batch,
    selectedFile,
    selectedOpenBatchRecord,
    selectedTargetEntityRecord,
    selectedSourceRecord,
    selectedEntityHandle,
    selectedSourceHandle,
    externalKeyColumns,
    genericReferenceEntityHandle,
    genericReferenceKeyColumns,
    selectedTemplateHandle,
    selectedTemplateRecord,
    selectedTemplateSummary,
    selectedTemplate,
    templateTitle,
    isApplyingTemplate,
    ...callbacks,
  })

  return {
    session,
    callbacks,
    batch,
    selectedFile,
    selectedOpenBatchRecord,
    selectedTargetEntityRecord,
    selectedSourceRecord,
    selectedEntityHandle,
    selectedSourceHandle,
    externalKeyColumns,
    genericReferenceEntityHandle,
    genericReferenceKeyColumns,
    selectedTemplateHandle,
    selectedTemplateSummary,
    templateTitle,
    template,
  }
}

describe('useSaplingImportBatchSession', () => {
  it('restores batch scope, template mapping, generic reference, and polling', async () => {
    const state = setup()
    const loadedBatch = {
      handle: 42,
      filename: 'companies.csv',
      status: 'validating',
      entityHandle: 'company',
      sourceHandle: 'erp',
      templateHandle: 11,
      mapping: { fieldDefaults: [{ targetField: 'country', value: 'DE' }] },
      externalKeyColumns: ['External Id', 'Missing'],
      genericReferenceMapping: {
        entityHandle: 'person',
        sourceHandle: 'erp',
        keyColumns: ['Person Id', 'Missing'],
      },
    } as ImportBatchSummary

    await state.session.hydrateBatchState(loadedBatch)

    expect(state.batch.value).toEqual(loadedBatch)
    expect(state.selectedEntityHandle.value).toBe('company')
    expect(state.selectedSourceHandle.value).toBe('erp')
    expect(state.selectedTargetEntityRecord.value).toEqual({ handle: 'company' })
    expect(state.selectedSourceRecord.value).toEqual({ handle: 'erp' })
    expect(state.selectedTemplateHandle.value).toBe(11)
    expect(state.selectedTemplateSummary.value).toEqual(state.template)
    expect(state.templateTitle.value).toBe('CRM import')
    expect(state.externalKeyColumns.value).toEqual(['External Id'])
    expect(state.genericReferenceEntityHandle.value).toBe('person')
    expect(state.genericReferenceKeyColumns.value).toEqual(['Person Id'])
    expect(state.callbacks.applyMappingConfiguration).toHaveBeenCalledWith({
      fieldDefaults: [{ targetField: 'country', value: 'DE' }],
      mappings: [{ targetField: 'name', sourceColumn: 'Name' }],
      valueMappings: [],
    })
    expect(state.callbacks.startBatchPolling).toHaveBeenCalledWith(42)
    expect(state.callbacks.trackImportBatch).toHaveBeenCalledWith(42)
  })

  it('synchronizes selectors and clears only the currently missing batch', async () => {
    const state = setup()
    state.batch.value = { handle: 42 } as ImportBatchSummary
    state.selectedTargetEntityRecord.value = { handle: 'person' }
    await nextTick()
    await nextTick()

    expect(state.selectedEntityHandle.value).toBe('person')
    expect(state.callbacks.loadEntityMetadata).toHaveBeenCalledWith('person')
    expect(state.callbacks.initializeMappings).toHaveBeenCalled()

    state.session.clearMissingBatch(41)
    expect(state.batch.value?.handle).toBe(42)

    state.session.clearMissingBatch(42)
    expect(state.batch.value).toBeNull()
    expect(state.selectedEntityHandle.value).toBeNull()
    expect(state.callbacks.clearMappingState).toHaveBeenCalled()
  })
})
