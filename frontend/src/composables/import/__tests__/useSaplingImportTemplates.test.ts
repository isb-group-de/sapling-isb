import { computed, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingGenericItem } from '@/entity/entity'
import type { ImportBatchSummary, ImportTemplateSummary } from '@/services/api.import.service'
import { useSaplingImportTemplates } from '../useSaplingImportTemplates'

const apiMocks = vi.hoisted(() => ({
  getTemplate: vi.fn(),
  saveTemplate: vi.fn(),
  updateTemplate: vi.fn(),
}))

vi.mock('@/services/api.import.service', () => ({
  default: apiMocks,
}))

const template: ImportTemplateSummary = {
  handle: 7,
  title: 'Companies',
  description: null,
  sourceHandle: 'erp',
  entityHandle: 'company',
  isActive: true,
  mapping: { mappings: [] },
  externalKeyColumns: ['External ID'],
  genericReferenceMapping: null,
}

describe('useSaplingImportTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getTemplate.mockResolvedValue(template)
    apiMocks.updateTemplate.mockResolvedValue(template)
  })

  function createTemplates() {
    const selectedEntityHandle = ref<string | null>('person')
    const selectedSourceHandle = ref<string | null>('legacy')
    const selectedTargetEntityRecord: Ref<SaplingGenericItem | null> = ref(null)
    const selectedSourceRecord: Ref<SaplingGenericItem | null> = ref(null)
    const onScopeChanged = vi.fn().mockResolvedValue(undefined)
    const applyTemplateConfiguration = vi.fn()
    const applySavedMapping = vi.fn()
    const notifyTemplateLoaded = vi.fn()
    const notifyTemplateSaved = vi.fn()
    const composable = useSaplingImportTemplates({
      batch: ref({ handle: 3 } as ImportBatchSummary),
      selectedEntityHandle,
      selectedSourceHandle,
      selectedTargetEntityRecord,
      selectedSourceRecord,
      hasTemplateContent: computed(() => true),
      buildTemplatePayload: () => ({
        entityHandle: selectedEntityHandle.value ?? '',
        sourceHandle: selectedSourceHandle.value,
        title: 'Companies',
        mappings: [],
      }),
      onScopeChanged,
      applyTemplateConfiguration,
      applySavedMapping,
      notifyTemplateLoaded,
      notifyTemplateSaved,
    })

    return {
      selectedEntityHandle,
      selectedSourceHandle,
      selectedTargetEntityRecord,
      selectedSourceRecord,
      onScopeChanged,
      applyTemplateConfiguration,
      applySavedMapping,
      notifyTemplateSaved,
      ...composable,
    }
  }

  it('loads a selected template and applies its entity/source scope', async () => {
    const templates = createTemplates()

    await templates.selectTemplateRecord({ handle: 7 })

    expect(apiMocks.getTemplate).toHaveBeenCalledWith(7)
    expect(templates.selectedEntityHandle.value).toBe('company')
    expect(templates.selectedSourceHandle.value).toBe('erp')
    expect(templates.selectedTargetEntityRecord.value).toEqual({ handle: 'company' })
    expect(templates.onScopeChanged).toHaveBeenCalledWith(true, true)
    expect(templates.applyTemplateConfiguration).toHaveBeenCalledWith(template)
    expect(templates.templateTitle.value).toBe('Companies')
  })

  it('updates the currently selected template and keeps its returned handle', async () => {
    const templates = createTemplates()
    templates.selectedTemplateHandle.value = 7
    templates.templateTitle.value = 'Companies'

    await templates.saveTemplate()

    expect(apiMocks.updateTemplate).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ handle: 7, title: 'Companies', isActive: true }),
    )
    expect(templates.selectedTemplateRecord.value).toEqual(
      expect.objectContaining({
        handle: 7,
        source: { handle: 'erp' },
        targetEntity: { handle: 'company' },
      }),
    )
    expect(templates.applySavedMapping).toHaveBeenCalledWith(template)
    expect(templates.notifyTemplateSaved).toHaveBeenCalledWith(template)
  })
})
