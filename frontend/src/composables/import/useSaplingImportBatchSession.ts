import { ref, watch, type ComputedRef, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiImportService, {
  type ImportBatchSummary,
  type ImportTemplateSummary,
} from '@/services/api.import.service'
import { isRunningImportStatus } from '@/composables/import/useSaplingImportBatchPolling'
import { importTemplateSummaryToGenericItem } from '@/composables/import/useSaplingImportTemplates'
import {
  mergeImportMappingConfiguration,
  normalizeGenericReferenceMapping,
  normalizeSelectedHandle,
  type ImportMappingConfiguration,
} from '@/composables/import/useSaplingImportMappingConfiguration'

export interface SaplingImportBatchSessionOptions {
  batch: Ref<ImportBatchSummary | null>
  selectedFile: Ref<File | File[] | null>
  selectedOpenBatchRecord: Ref<SaplingGenericItem | null>
  selectedTargetEntityRecord: Ref<SaplingGenericItem | null>
  selectedSourceRecord: Ref<SaplingGenericItem | null>
  selectedEntityHandle: Ref<string | null>
  selectedSourceHandle: Ref<string | null>
  externalKeyColumns: Ref<string[]>
  genericReferenceEntityHandle: Ref<string | null>
  genericReferenceKeyColumns: Ref<string[]>
  selectedTemplateHandle: Ref<number | string | null>
  selectedTemplateRecord: Ref<SaplingGenericItem | null>
  selectedTemplateSummary: Ref<ImportTemplateSummary | null>
  selectedTemplate: ComputedRef<ImportTemplateSummary | null>
  templateTitle: Ref<string>
  isApplyingTemplate: Ref<boolean>
  clearSelectedTemplate: () => void
  selectTemplateRecord: (record: SaplingGenericItem) => Promise<void>
  loadSelectedTemplateSummary: () => Promise<ImportTemplateSummary | null>
  loadEntityMetadata: (entityHandle: string) => Promise<void>
  loadTranslations: () => Promise<unknown>
  initializeMappings: () => void
  clearMappingState: () => void
  applyMappingConfiguration: (configuration: ImportMappingConfiguration) => void
  filterExistingColumns: (columns: string[]) => string[]
  startBatchPolling: (handle: number) => void
  trackImportBatch: (handle: number) => void
  notifyBatchLoaded: (batch: ImportBatchSummary) => void
}

export function useSaplingImportBatchSession(options: SaplingImportBatchSessionOptions) {
  const isLoadingOpenBatches = ref(false)
  const isHydratingBatch = ref(false)

  watch(options.selectedOpenBatchRecord, (selectedBatch) => {
    if (selectedBatch) {
      void loadSelectedOpenBatch(selectedBatch.handle)
    }
  })

  watch(options.selectedTargetEntityRecord, (selectedEntityRecord) => {
    if (!isSessionTransitionRunning()) {
      options.selectedEntityHandle.value = normalizeSelectedHandle(selectedEntityRecord?.handle)
    }
  })

  watch(options.selectedSourceRecord, (selectedSource) => {
    if (!isSessionTransitionRunning()) {
      options.selectedSourceHandle.value = normalizeSelectedHandle(selectedSource?.handle)
    }
  })

  watch(options.selectedEntityHandle, async (entityHandle) => {
    if (isSessionTransitionRunning()) {
      return
    }

    options.clearSelectedTemplate()
    if (entityHandle) {
      await options.loadEntityMetadata(entityHandle)
    }
    options.initializeMappings()
  })

  watch(options.selectedSourceHandle, () => {
    if (!isSessionTransitionRunning()) {
      options.clearSelectedTemplate()
    }
  })

  watch(options.selectedTemplateRecord, (template) => {
    if (isSessionTransitionRunning()) {
      return
    }
    if (!template) {
      options.clearSelectedTemplate()
      return
    }
    void options.selectTemplateRecord(template)
  })

  async function loadSelectedOpenBatch(value: number | string | null): Promise<void> {
    const handle = Number(value)
    if (!Number.isFinite(handle)) {
      return
    }

    try {
      isLoadingOpenBatches.value = true
      const loadedBatch = await ApiImportService.getBatch(Math.trunc(handle))
      await hydrateBatchState(loadedBatch)
      options.notifyBatchLoaded(loadedBatch)
    } catch {
      // shared API errors already surface through the message center
    } finally {
      isLoadingOpenBatches.value = false
    }
  }

  async function hydrateBatchState(loadedBatch: ImportBatchSummary): Promise<void> {
    isHydratingBatch.value = true

    try {
      applyBatchScope(loadedBatch)
      options.selectedTemplateHandle.value = loadedBatch.templateHandle ?? null
      options.selectedTemplateSummary.value = await options.loadSelectedTemplateSummary()
      options.selectedTemplateRecord.value = options.selectedTemplateSummary.value
        ? importTemplateSummaryToGenericItem(options.selectedTemplateSummary.value)
        : null
      options.templateTitle.value = ''

      if (options.selectedEntityHandle.value) {
        await Promise.all([
          options.loadEntityMetadata(options.selectedEntityHandle.value),
          options.loadTranslations(),
        ])
      }

      options.templateTitle.value = options.selectedTemplate.value?.title ?? ''
      options.initializeMappings()
      options.applyMappingConfiguration(
        mergeImportMappingConfiguration(
          options.selectedTemplate.value?.mapping,
          loadedBatch.mapping,
        ),
      )
      options.externalKeyColumns.value = options.filterExistingColumns(
        loadedBatch.externalKeyColumns ?? [],
      )
      applyGenericReferenceMapping(loadedBatch)

      if (isRunningImportStatus(loadedBatch.status) && loadedBatch.handle) {
        options.startBatchPolling(loadedBatch.handle)
        options.trackImportBatch(loadedBatch.handle)
      }
    } finally {
      isHydratingBatch.value = false
    }
  }

  function clearMissingBatch(handle: number): void {
    if (options.batch.value?.handle !== handle) {
      return
    }

    options.batch.value = null
    options.selectedFile.value = null
    options.selectedOpenBatchRecord.value = null
    options.selectedTargetEntityRecord.value = null
    options.selectedSourceRecord.value = null
    options.selectedEntityHandle.value = null
    options.selectedSourceHandle.value = null
    options.externalKeyColumns.value = []
    options.genericReferenceEntityHandle.value = null
    options.genericReferenceKeyColumns.value = []
    options.clearSelectedTemplate()
    options.clearMappingState()
  }

  function applyBatchScope(loadedBatch: ImportBatchSummary): void {
    options.batch.value = loadedBatch
    options.selectedFile.value = null
    options.selectedEntityHandle.value = loadedBatch.entityHandle ?? null
    options.selectedSourceHandle.value = loadedBatch.sourceHandle ?? null
    options.selectedTargetEntityRecord.value = options.selectedEntityHandle.value
      ? { handle: options.selectedEntityHandle.value }
      : null
    options.selectedSourceRecord.value = options.selectedSourceHandle.value
      ? { handle: options.selectedSourceHandle.value }
      : null
  }

  function applyGenericReferenceMapping(loadedBatch: ImportBatchSummary): void {
    const mapping = normalizeGenericReferenceMapping(loadedBatch.genericReferenceMapping)
    options.genericReferenceEntityHandle.value = mapping?.entityHandle ?? null
    options.genericReferenceKeyColumns.value = options.filterExistingColumns(
      mapping?.keyColumns ?? [],
    )
  }

  function isSessionTransitionRunning(): boolean {
    return isHydratingBatch.value || options.isApplyingTemplate.value
  }

  return {
    isLoadingOpenBatches,
    isHydratingBatch,
    loadSelectedOpenBatch,
    hydrateBatchState,
    clearMissingBatch,
  }
}
