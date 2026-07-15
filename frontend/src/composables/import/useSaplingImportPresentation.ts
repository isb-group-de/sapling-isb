import { computed, type ComputedRef, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import type { ImportBatchRowSummary, ImportBatchSummary } from '@/services/api.import.service'
import { isRunningImportStatus } from '@/composables/import/useSaplingImportBatchPolling'

export const IMPORT_PREVIEW_ROW_LIMIT = 100

export type ImportErrorReportRow = ImportBatchRowSummary & {
  rawData: Record<string, unknown>
}

export interface SaplingImportPresentationOptions {
  batch: Ref<ImportBatchSummary | null>
  selectedEntityHandle: Ref<string | null>
  selectedEntityTemplates: ComputedRef<EntityTemplate[]>
  getIsExecuting: () => boolean
  translate: (key: string, params?: Record<string, unknown>) => string
  hasTranslation: (key: string) => boolean
}

const MESSAGE_PREFIXES = {
  required: 'import.requiredFieldsMissing:',
  invalidDate: 'import.invalidDateValues:',
  invalidBoolean: 'import.invalidBooleanValues:',
  missingValueMapping: 'import.valueMappingMissing:',
  uniqueConflict: 'import.uniqueFieldConflict:',
  uniqueBatchDuplicate: 'import.uniqueFieldDuplicateInBatch:',
} as const

export function useSaplingImportPresentation(options: SaplingImportPresentationOptions) {
  const sampleHeaders = computed(() => options.batch.value?.headers.slice(0, 8) ?? [])
  const previewRows = computed(
    () => options.batch.value?.rows.slice(0, IMPORT_PREVIEW_ROW_LIMIT) ?? [],
  )
  const errorReportRows = computed<ImportErrorReportRow[]>(() =>
    (options.batch.value?.rows ?? []).filter(
      (row): row is ImportErrorReportRow =>
        (row.status === 'error' || row.status === 'failed') &&
        Boolean(row.rawData) &&
        typeof row.rawData === 'object',
    ),
  )
  const saplingPreviewItems = computed<SaplingGenericItem[]>(() =>
    (options.batch.value?.rows ?? [])
      .filter((row) => row.payload && row.status !== 'error' && row.status !== 'failed')
      .slice(0, 3)
      .map((row) => ({
        ...(row.payload ?? {}),
        handle: row.payload?.handle ?? `preview-${row.rowNumber}`,
      })),
  )
  const entityPreviewTitle = computed(() =>
    options.selectedEntityHandle.value
      ? entityLabel(options.selectedEntityHandle.value)
      : options.translate('import.targetEntity'),
  )
  const hasGenericReference = computed(() =>
    options.selectedEntityTemplates.value.some((template) => template.genericReference),
  )
  const hasValidationErrors = computed(() => (options.batch.value?.errorCount ?? 0) > 0)
  const hasErrorReportRows = computed(
    () =>
      errorReportRows.value.length > 0 ||
      (options.batch.value?.errorCount ?? 0) > 0 ||
      (options.batch.value?.failedCount ?? 0) > 0,
  )
  const isPreviewLimited = computed(
    () =>
      (options.batch.value?.rowCount ?? options.batch.value?.rows.length ?? 0) >
      IMPORT_PREVIEW_ROW_LIMIT,
  )
  const isImportJobRunning = computed(() =>
    options.batch.value ? isRunningImportStatus(options.batch.value.status) : false,
  )
  const isExecutionRunning = computed(() =>
    options.batch.value
      ? ['executionQueued', 'executing'].includes(options.batch.value.status)
      : false,
  )
  const importProgressPercent = computed(() => {
    const totalRows = options.batch.value?.rowCount ?? 0
    if (totalRows <= 0) return 0
    return Math.min(100, Math.round(((options.batch.value?.processedCount ?? 0) / totalRows) * 100))
  })
  const currentImportStatusLabel = computed(() =>
    options.batch.value?.status ? importStatusLabel(options.batch.value.status) : '-',
  )
  const importProgressLabel = computed(() =>
    options.translate('import.jobProgress', {
      processed: options.batch.value?.processedCount ?? 0,
      total: options.batch.value?.rowCount ?? 0,
    }),
  )
  const executeButtonLabel = computed(() =>
    hasValidationErrors.value
      ? options.translate('import.executeWithoutInvalidRows')
      : options.translate('import.execute'),
  )
  const executeButtonColor = computed(() => (hasValidationErrors.value ? 'warning' : 'primary'))
  const canExecute = computed(
    () =>
      Boolean(options.batch.value?.handle) &&
      (options.batch.value?.readyCount ?? 0) > 0 &&
      (options.batch.value?.status === 'validated' ||
        options.batch.value?.status === 'validatedWithErrors') &&
      !options.getIsExecuting() &&
      !isImportJobRunning.value,
  )

  function fieldLabel(fieldName: string): string {
    const template = options.selectedEntityTemplates.value.find((field) => field.name === fieldName)
    if (template?.formConfig?.label) return template.formConfig.label
    if (!options.selectedEntityHandle.value) return ''

    const key = `${options.selectedEntityHandle.value}.${fieldName}`
    return options.hasTranslation(key) ? options.translate(key) : ''
  }

  function entityLabel(entityHandle: string): string {
    const key = `navigation.${entityHandle}`
    return options.hasTranslation(key) ? options.translate(key) : ''
  }

  function importStatusLabel(status: string): string {
    const key = `import.status.${status}`
    return options.hasTranslation(key) ? options.translate(key) : ''
  }

  function importActionLabel(action: string): string {
    const key = `import.action.${action}`
    return options.hasTranslation(key) ? options.translate(key) : ''
  }

  function importMessageLabel(message: string | null | undefined): string {
    if (!message) return options.translate('global.notAvailable')

    if (message.startsWith(MESSAGE_PREFIXES.required)) {
      return fieldListMessage(
        message,
        MESSAGE_PREFIXES.required,
        'import.requiredFieldsMissing',
        'import.requiredFieldMissing',
      )
    }
    if (message.startsWith(MESSAGE_PREFIXES.invalidDate)) {
      return fieldListMessage(
        message,
        MESSAGE_PREFIXES.invalidDate,
        'import.invalidDateValues',
        'import.invalidDateValue',
      )
    }
    if (message.startsWith(MESSAGE_PREFIXES.invalidBoolean)) {
      return fieldListMessage(
        message,
        MESSAGE_PREFIXES.invalidBoolean,
        'import.invalidBooleanValues',
        'global.validationError',
      )
    }
    if (message.startsWith(MESSAGE_PREFIXES.missingValueMapping)) {
      const [fieldName = '', sourceValue = ''] = decodeParts(
        message,
        MESSAGE_PREFIXES.missingValueMapping,
      )
      const field = fieldName ? fieldLabel(fieldName) : options.translate('import.valueMapping')
      return sourceValue
        ? options.translate('import.valueMappingMissingWithDetails', {
            field,
            value: sourceValue,
          })
        : options.translate('import.valueMappingMissing')
    }
    if (
      message.startsWith(MESSAGE_PREFIXES.uniqueConflict) ||
      message.startsWith(MESSAGE_PREFIXES.uniqueBatchDuplicate)
    ) {
      return uniqueConflictMessage(message)
    }
    return options.hasTranslation(message) ? options.translate(message) : ''
  }

  function fieldListMessage(
    message: string,
    prefix: string,
    pluralKey: string,
    fallbackKey: string,
  ): string {
    const fields = message
      .slice(prefix.length)
      .split(',')
      .map((fieldName) => fieldLabel(fieldName.trim()))
      .filter(Boolean)
      .join(', ')
    return fields ? options.translate(pluralKey, { fields }) : options.translate(fallbackKey)
  }

  function uniqueConflictMessage(message: string): string {
    const isBatchDuplicate = message.startsWith(MESSAGE_PREFIXES.uniqueBatchDuplicate)
    const prefix = isBatchDuplicate
      ? MESSAGE_PREFIXES.uniqueBatchDuplicate
      : MESSAGE_PREFIXES.uniqueConflict
    const [fieldName = '', value = ''] = decodeParts(message, prefix)
    const field = fieldName ? fieldLabel(fieldName) : options.translate('import.uniqueField')
    return options.translate(
      isBatchDuplicate
        ? 'import.uniqueFieldDuplicateInBatchWithDetails'
        : 'import.uniqueFieldConflictWithDetails',
      { field, value },
    )
  }

  return {
    sampleHeaders,
    previewRows,
    errorReportRows,
    saplingPreviewItems,
    entityPreviewTitle,
    hasGenericReference,
    hasValidationErrors,
    hasErrorReportRows,
    isPreviewLimited,
    isImportJobRunning,
    isExecutionRunning,
    importProgressPercent,
    currentImportStatusLabel,
    importProgressLabel,
    executeButtonLabel,
    executeButtonColor,
    canExecute,
    fieldLabel,
    entityLabel,
    importStatusLabel,
    importActionLabel,
    importMessageLabel,
  }
}

function decodeParts(message: string, prefix: string): string[] {
  return message.slice(prefix.length).split(':').map(decodeImportMessagePart)
}

function decodeImportMessagePart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
