import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportBatchSummary } from '@/services/api.import.service'
import { useSaplingImportCommands } from '@/composables/import/useSaplingImportCommands'

const api = vi.hoisted(() => ({
  analyzeCsv: vi.fn(),
  configureBatch: vi.fn(),
  executeBatch: vi.fn(),
  getBatchErrorRows: vi.fn(),
}))
const downloadTextFile = vi.hoisted(() => vi.fn())

vi.mock('@/services/api.import.service', () => ({ default: api }))
vi.mock('@/composables/table/saplingTableAction.utils', () => ({ downloadTextFile }))

function importBatch(overrides: Partial<ImportBatchSummary> = {}): ImportBatchSummary {
  return {
    handle: 42,
    filename: 'companies.csv',
    status: 'analyzed',
    mapping: null,
    rows: [],
    ...overrides,
  } as ImportBatchSummary
}

function setup(initialBatch: ImportBatchSummary | null = null) {
  const batch = ref<ImportBatchSummary | null>(initialBatch)
  const selectedOpenBatchRecord = ref(null)
  const selectedEntityHandle = ref<string | null>('company')
  const callbacks = {
    clearSelectedTemplate: vi.fn(),
    initializeMappings: vi.fn(),
    buildTemplatePayload: vi.fn(() => ({
      entityHandle: 'company',
      sourceHandle: null,
      templateHandle: null,
      keyColumns: [],
      mappings: [],
      fieldDefaults: [],
      relationMappings: [],
      valueMappings: [],
      uniqueConflictStrategies: [],
      genericReferenceMapping: null,
      title: '',
    })),
    applyValueMappings: vi.fn(),
    trackImportBatch: vi.fn(),
    startBatchPolling: vi.fn(),
    importStatusLabel: vi.fn((status: string) => status),
    importActionLabel: vi.fn((action: string) => action),
    importMessageLabel: vi.fn((message: string | null | undefined) => message ?? ''),
    notifyAnalysisCompleted: vi.fn(),
    notifyValidationStarted: vi.fn(),
    notifyExecutionStarted: vi.fn(),
  }
  const commands = useSaplingImportCommands({
    batch,
    selectedOpenBatchRecord,
    selectedEntityHandle,
    errorReportRows: computed(() => []),
    ...callbacks,
  })
  return { commands, callbacks, batch }
}

describe('useSaplingImportCommands', () => {
  beforeEach(() => vi.clearAllMocks())

  it('analyzes a file and resets the active template session', async () => {
    const analyzedBatch = importBatch()
    api.analyzeCsv.mockResolvedValue(analyzedBatch)
    const state = setup()
    const file = new File(['name\nAcme'], 'companies.csv', { type: 'text/csv' })

    await state.commands.analyzeSelectedFile(file)

    expect(api.analyzeCsv).toHaveBeenCalledWith(file)
    expect(state.batch.value).toEqual(analyzedBatch)
    expect(state.callbacks.clearSelectedTemplate).toHaveBeenCalled()
    expect(state.callbacks.initializeMappings).toHaveBeenCalled()
    expect(state.callbacks.notifyAnalysisCompleted).toHaveBeenCalledWith('companies.csv')
    expect(state.commands.isAnalyzing.value).toBe(false)
  })

  it('configures and executes a batch while restarting tracking and polling', async () => {
    const configuredBatch = importBatch({
      status: 'validationQueued',
      mapping: { mappings: [{ targetField: 'name', sourceColumn: 'Name' }] },
    })
    const executedBatch = importBatch({ status: 'executionQueued' })
    api.configureBatch.mockResolvedValue(configuredBatch)
    api.executeBatch.mockResolvedValue(executedBatch)
    const state = setup(importBatch())

    await state.commands.configureBatch()
    await state.commands.executeBatch()

    expect(api.configureBatch).toHaveBeenCalledWith(
      42,
      state.callbacks.buildTemplatePayload.mock.results[0]?.value,
    )
    expect(state.callbacks.applyValueMappings).toHaveBeenCalledWith(configuredBatch.mapping)
    expect(api.executeBatch).toHaveBeenCalledWith(42)
    expect(state.callbacks.trackImportBatch).toHaveBeenNthCalledWith(1, 42)
    expect(state.callbacks.trackImportBatch).toHaveBeenNthCalledWith(2, 42)
    expect(state.callbacks.startBatchPolling).toHaveBeenCalledTimes(2)
    expect(state.callbacks.notifyValidationStarted).toHaveBeenCalledWith(configuredBatch)
    expect(state.callbacks.notifyExecutionStarted).toHaveBeenCalledWith(executedBatch)
  })

  it('downloads persisted error rows as a CSV report', async () => {
    api.getBatchErrorRows.mockResolvedValue([
      {
        rowNumber: 2,
        status: 'error',
        action: null,
        targetReference: null,
        message: 'import.invalid',
        externalKeyHash: null,
        rawData: { Name: 'Acme' },
      },
    ])
    const state = setup(importBatch())

    await state.commands.downloadErrorReport()

    expect(api.getBatchErrorRows).toHaveBeenCalledWith(42)
    expect(downloadTextFile).toHaveBeenCalledWith(
      expect.stringContaining('raw.Name'),
      'companies-fehlerprotokoll.csv',
      'text/csv;charset=utf-8',
    )
    expect(state.commands.isDownloadingErrorReport.value).toBe(false)
  })
})
