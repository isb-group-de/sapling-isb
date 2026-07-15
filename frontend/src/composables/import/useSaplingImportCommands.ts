import { ref, type ComputedRef, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiImportService, {
  type ImportBatchRowSummary,
  type ImportBatchSummary,
  type SaveImportTemplatePayload,
} from '@/services/api.import.service'
import type { ImportMappingConfiguration } from '@/composables/import/useSaplingImportMappingConfiguration'
import {
  buildImportErrorReportCsv,
  createImportErrorReportFilename,
} from '@/composables/import/saplingImportErrorReport'
import { downloadTextFile } from '@/composables/table/saplingTableAction.utils'

export interface SaplingImportCommandOptions {
  batch: Ref<ImportBatchSummary | null>
  selectedOpenBatchRecord: Ref<SaplingGenericItem | null>
  selectedEntityHandle: Ref<string | null>
  errorReportRows: ComputedRef<ImportBatchRowSummary[]>
  clearSelectedTemplate: () => void
  initializeMappings: () => void
  buildTemplatePayload: () => SaveImportTemplatePayload
  applyValueMappings: (mapping: ImportMappingConfiguration) => void
  trackImportBatch: (handle: number) => void
  startBatchPolling: (handle: number) => void
  importStatusLabel: (status: string) => string
  importActionLabel: (action: string) => string
  importMessageLabel: (message: string | null | undefined) => string
  notifyAnalysisCompleted: (filename: string) => void
  notifyValidationStarted: (batch: ImportBatchSummary) => void
  notifyExecutionStarted: (batch: ImportBatchSummary) => void
}

export function useSaplingImportCommands(options: SaplingImportCommandOptions) {
  const isAnalyzing = ref(false)
  const isConfiguring = ref(false)
  const isExecuting = ref(false)
  const isDownloadingErrorReport = ref(false)

  async function analyzeSelectedFile(value: File | File[] | null): Promise<void> {
    const file = Array.isArray(value) ? value[0] : value
    if (!file) {
      return
    }

    try {
      isAnalyzing.value = true
      options.selectedOpenBatchRecord.value = null
      options.clearSelectedTemplate()
      options.batch.value = await ApiImportService.analyzeCsv(file)
      options.initializeMappings()
      options.notifyAnalysisCompleted(file.name)
    } catch {
      // shared API errors already surface through the message center
    } finally {
      isAnalyzing.value = false
    }
  }

  async function configureBatch(): Promise<void> {
    if (!options.batch.value?.handle || !options.selectedEntityHandle.value) {
      return
    }

    try {
      isConfiguring.value = true
      const configuredBatch = await ApiImportService.configureBatch(
        options.batch.value.handle,
        options.buildTemplatePayload(),
      )
      options.batch.value = configuredBatch
      options.applyValueMappings(configuredBatch.mapping)
      if (configuredBatch.handle != null) {
        options.trackImportBatch(configuredBatch.handle)
        options.startBatchPolling(configuredBatch.handle)
      }
      options.notifyValidationStarted(configuredBatch)
    } catch {
      // shared API errors already surface through the message center
    } finally {
      isConfiguring.value = false
    }
  }

  async function executeBatch(): Promise<void> {
    if (!options.batch.value?.handle) {
      return
    }

    try {
      isExecuting.value = true
      const executedBatch = await ApiImportService.executeBatch(options.batch.value.handle)
      options.batch.value = executedBatch
      if (executedBatch.handle != null) {
        options.trackImportBatch(executedBatch.handle)
        options.startBatchPolling(executedBatch.handle)
      }
      options.notifyExecutionStarted(executedBatch)
    } catch {
      // shared API errors already surface through the message center
    } finally {
      isExecuting.value = false
    }
  }

  async function downloadErrorReport(): Promise<void> {
    if (!options.batch.value) {
      return
    }

    try {
      isDownloadingErrorReport.value = true
      const rows = options.batch.value.handle
        ? await ApiImportService.getBatchErrorRows(options.batch.value.handle)
        : options.errorReportRows.value
      if (rows.length === 0) {
        return
      }

      downloadTextFile(
        buildImportErrorReportCsv(rows, {
          importStatusLabel: options.importStatusLabel,
          importActionLabel: options.importActionLabel,
          importMessageLabel: options.importMessageLabel,
        }),
        createImportErrorReportFilename(options.batch.value.filename),
        'text/csv;charset=utf-8',
      )
    } catch {
      // shared API errors already surface through the message center
    } finally {
      isDownloadingErrorReport.value = false
    }
  }

  return {
    isAnalyzing,
    isConfiguring,
    isExecuting,
    isDownloadingErrorReport,
    analyzeSelectedFile,
    configureBatch,
    executeBatch,
    downloadErrorReport,
  }
}
