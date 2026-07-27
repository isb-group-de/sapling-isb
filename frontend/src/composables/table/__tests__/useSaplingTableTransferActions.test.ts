import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  downloadJSON: vi.fn(),
  importRows: vi.fn(),
  downloadJSONFile: vi.fn(),
  downloadTextFile: vi.fn(),
  isSupportedCsvFile: vi.fn(),
  parseCsv: vi.fn(),
  buildCsv: vi.fn(),
  buildCsvTemplate: vi.fn(),
  pushMessage: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    downloadJSON: mocks.downloadJSON,
    importRows: mocks.importRows,
  },
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

vi.mock('@/composables/table/saplingTableAction.utils', () => ({
  downloadJSONFile: mocks.downloadJSONFile,
  downloadTextFile: mocks.downloadTextFile,
  isSupportedCsvFile: mocks.isSupportedCsvFile,
}))

vi.mock('@/utils/saplingCsvUtil', () => ({
  parseCsv: mocks.parseCsv,
  buildCsv: mocks.buildCsv,
  buildCsvTemplate: mocks.buildCsvTemplate,
}))

import { useSaplingTableTransferActions } from '../useSaplingTableTransferActions'

function createSubject() {
  const selectedItems = ref([{ handle: 11, title: 'Selected' }])
  const props = reactive({
    search: '',
    sortBy: [],
    entityHandle: 'ticket',
    entityTemplates: [],
    parentFilter: undefined,
    activeFilter: undefined,
  })

  return useSaplingTableTransferActions({
    props,
    localColumnFilters: ref({}),
    selectedItems,
    reload: mocks.reload,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isSupportedCsvFile.mockReturnValue(true)
  mocks.parseCsv.mockReturnValue([{ title: 'Imported' }])
  mocks.importRows.mockResolvedValue({
    created: 1,
    updated: 0,
    failed: 0,
    skipped: 0,
  })
})

describe('useSaplingTableTransferActions', () => {
  it('reloads the table when a refresh is requested', () => {
    const subject = createSubject()

    subject.refreshTable()

    expect(mocks.reload).toHaveBeenCalledOnce()
  })

  it('imports supported CSV files and reloads the table', async () => {
    const subject = createSubject()
    const file = {
      name: 'tickets.csv',
      type: 'text/csv',
      text: vi.fn().mockResolvedValue('title\nImported'),
    } as unknown as File

    await subject.importCSVFile(file)

    expect(mocks.parseCsv).toHaveBeenCalledWith('title\nImported')
    expect(mocks.importRows).toHaveBeenCalledWith('ticket', [{ title: 'Imported' }])
    expect(mocks.reload).toHaveBeenCalledOnce()
    expect(subject.isImportingCSV.value).toBe(false)
  })

  it('rejects unsupported files without calling the import API', async () => {
    mocks.isSupportedCsvFile.mockReturnValue(false)
    const subject = createSubject()

    await subject.importCSVFile({ name: 'tickets.xlsx' } as File)

    expect(mocks.importRows).not.toHaveBeenCalled()
    expect(mocks.pushMessage).toHaveBeenCalledWith(
      'warning',
      'global.csvImportUnsupportedFile',
      'global.csvImportUnsupportedFileDescription',
      'ticket',
    )
  })

  it('exports the current selection without querying the backend', () => {
    const subject = createSubject()

    subject.exportSelectedJSON()

    expect(mocks.downloadJSONFile).toHaveBeenCalledWith(
      [{ handle: 11, title: 'Selected' }],
      'ticket-selected.json',
    )
    expect(mocks.downloadJSON).not.toHaveBeenCalled()
  })
})
