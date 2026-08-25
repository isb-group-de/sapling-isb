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
  mapCsvRowsToInternalFields: vi.fn(),
  pushMessage: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'ticket.handle': 'ID',
        'ticket.title': 'Bezeichnung',
      })[key] ?? key,
  }),
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
  mapCsvRowsToInternalFields: mocks.mapCsvRowsToInternalFields,
}))

import { useSaplingTableTransferActions } from '../useSaplingTableTransferActions'

function createSubject() {
  const selectedItems = ref([{ handle: 11, title: 'Selected' }])
  const props = reactive({
    search: '',
    sortBy: [],
    entityHandle: 'ticket',
    entityTemplates: [
      {
        key: 'title',
        name: 'title',
        type: 'string',
        isPersistent: true,
        options: [],
      },
    ],
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
  mocks.mapCsvRowsToInternalFields.mockReturnValue([{ title: 'Imported' }])
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
    expect(mocks.mapCsvRowsToInternalFields).toHaveBeenCalledWith(
      [{ title: 'Imported' }],
      expect.any(Array),
      expect.any(Function),
    )
    expect(mocks.importRows).toHaveBeenCalledWith('ticket', [{ title: 'Imported' }])
    expect(mocks.reload).toHaveBeenCalledOnce()
    expect(subject.isImportingCSV.value).toBe(false)
  })

  it('uses the current translated table labels for CSV exports and templates', async () => {
    mocks.downloadJSON.mockResolvedValue([{ handle: 1, title: 'Planning' }])
    const subject = createSubject()

    subject.exportCSVTemplate()
    await subject.exportCSV()

    const templateResolver = mocks.buildCsvTemplate.mock.calls[0]?.[1]
    const exportResolver = mocks.buildCsv.mock.calls[0]?.[2]
    const titleTemplate = {
      name: 'title',
      formConfig: { label: 'Individuelle Bezeichnung' },
    }

    expect(templateResolver('handle')).toBe('ID')
    expect(exportResolver('title')).toBe('Bezeichnung')
    expect(exportResolver('title', titleTemplate)).toBe('Individuelle Bezeichnung')
  })

  it('keeps internal field names in JSON exports', async () => {
    const items = [{ handle: 1, title: 'Planning' }]
    mocks.downloadJSON.mockResolvedValue(items)
    const subject = createSubject()

    await subject.downloadJSON()

    expect(mocks.downloadJSONFile).toHaveBeenCalledWith(items, 'ticket.json')
    expect(mocks.buildCsv).not.toHaveBeenCalled()
    expect(mocks.buildCsvTemplate).not.toHaveBeenCalled()
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
