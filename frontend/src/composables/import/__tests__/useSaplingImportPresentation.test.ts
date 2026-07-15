import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import type { ImportBatchSummary } from '@/services/api.import.service'
import { useSaplingImportPresentation } from '@/composables/import/useSaplingImportPresentation'

function setup() {
  const batch = ref<ImportBatchSummary | null>({
    handle: 42,
    filename: 'companies.csv',
    status: 'validatedWithErrors',
    rowCount: 4,
    processedCount: 2,
    readyCount: 2,
    errorCount: 1,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    headers: ['Name', 'Status'],
    sampleRows: [],
    resultSummary: {
      totalRows: 4,
      processedRows: 2,
      readyRows: 2,
      errorRows: 1,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      failedRows: 0,
    },
    rows: [
      {
        handle: 1,
        rowNumber: 2,
        status: 'ready',
        action: 'created',
        targetReference: null,
        externalKeyHash: null,
        externalKeyParts: null,
        payload: { handle: 7, name: 'Acme' },
        rawData: { Name: 'Acme' },
        message: null,
      },
      {
        handle: 2,
        rowNumber: 3,
        status: 'error',
        action: null,
        targetReference: null,
        externalKeyHash: null,
        externalKeyParts: null,
        payload: null,
        rawData: { Name: '' },
        message: 'import.requiredFieldsMissing:name',
      },
    ],
  } as ImportBatchSummary)
  const selectedEntityHandle = ref<string | null>('company')
  const selectedEntityTemplates = computed(
    () =>
      [
        {
          name: 'name',
          formConfig: { label: 'Company name' },
        },
        {
          name: 'reference',
          genericReference: { entityField: 'entity', handleField: 'reference' },
        },
      ] as EntityTemplate[],
  )
  const knownTranslations = new Set([
    'navigation.company',
    'import.status.validatedWithErrors',
    'import.action.created',
  ])
  const presentation = useSaplingImportPresentation({
    batch,
    selectedEntityHandle,
    selectedEntityTemplates,
    getIsExecuting: () => false,
    translate: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    hasTranslation: (key) => knownTranslations.has(key),
  })
  return { presentation, batch }
}

describe('useSaplingImportPresentation', () => {
  it('projects preview, progress, execution, and error-report state', () => {
    const { presentation } = setup()

    expect(presentation.sampleHeaders.value).toEqual(['Name', 'Status'])
    expect(presentation.saplingPreviewItems.value).toEqual([{ handle: 7, name: 'Acme' }])
    expect(presentation.errorReportRows.value).toHaveLength(1)
    expect(presentation.entityPreviewTitle.value).toBe('navigation.company')
    expect(presentation.hasGenericReference.value).toBe(true)
    expect(presentation.hasValidationErrors.value).toBe(true)
    expect(presentation.hasErrorReportRows.value).toBe(true)
    expect(presentation.importProgressPercent.value).toBe(50)
    expect(presentation.currentImportStatusLabel.value).toBe('import.status.validatedWithErrors')
    expect(presentation.executeButtonColor.value).toBe('warning')
    expect(presentation.canExecute.value).toBe(true)
  })

  it('translates structured validation, value-mapping, and unique messages', () => {
    const { presentation } = setup()

    expect(presentation.fieldLabel('name')).toBe('Company name')
    expect(presentation.importMessageLabel('import.requiredFieldsMissing:name')).toBe(
      'import.requiredFieldsMissing:{"fields":"Company name"}',
    )
    expect(
      presentation.importMessageLabel('import.valueMappingMissing:name:External%20Company'),
    ).toBe(
      'import.valueMappingMissingWithDetails:{"field":"Company name","value":"External Company"}',
    )
    expect(presentation.importMessageLabel('import.uniqueFieldConflict:name:Acme%20AG')).toBe(
      'import.uniqueFieldConflictWithDetails:{"field":"Company name","value":"Acme AG"}',
    )
  })
})
