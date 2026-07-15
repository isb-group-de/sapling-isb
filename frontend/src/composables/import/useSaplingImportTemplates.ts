import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiImportService, {
  type ImportBatchSummary,
  type ImportTemplateSummary,
  type SaveImportTemplatePayload,
} from '@/services/api.import.service'
import type { FilterQuery } from '@/services/api.generic.service'

export interface SaplingImportTemplateOptions {
  batch: Ref<ImportBatchSummary | null>
  selectedEntityHandle: Ref<string | null>
  selectedSourceHandle: Ref<string | null>
  selectedTargetEntityRecord: Ref<SaplingGenericItem | null>
  selectedSourceRecord: Ref<SaplingGenericItem | null>
  hasTemplateContent: ComputedRef<boolean>
  buildTemplatePayload: () => SaveImportTemplatePayload
  onScopeChanged: (entityChanged: boolean, sourceChanged: boolean) => Promise<void>
  applyTemplateConfiguration: (template: ImportTemplateSummary) => void
  applySavedMapping: (template: ImportTemplateSummary) => void
  notifyTemplateLoaded: (template: ImportTemplateSummary) => void
  notifyTemplateSaved: (template: ImportTemplateSummary) => void
}

export function useSaplingImportTemplates(options: SaplingImportTemplateOptions) {
  const selectedTemplateHandle = ref<number | string | null>(null)
  const selectedTemplateRecord = ref<SaplingGenericItem | null>(null)
  const selectedTemplateSummary = ref<ImportTemplateSummary | null>(null)
  const templateTitle = ref('')
  const isSavingTemplate = ref(false)
  const isApplyingTemplate = ref(false)
  let loadRequestId = 0

  const selectedTemplate = computed(() => selectedTemplateSummary.value)
  const selectedTemplatePlaceholder = computed(() =>
    selectedTemplateHandle.value == null || selectedTemplateHandle.value === ''
      ? null
      : String(selectedTemplateHandle.value),
  )
  const templateFilter = computed<FilterQuery>(() => ({
    isActive: true,
    ...(options.selectedEntityHandle.value
      ? { targetEntity: { handle: options.selectedEntityHandle.value } }
      : {}),
    ...(options.selectedSourceHandle.value
      ? { source: { handle: options.selectedSourceHandle.value } }
      : {}),
  }))
  const canSelectTemplates = computed(() => Boolean(options.batch.value?.handle))
  const canUseTemplates = computed(() =>
    Boolean(
      options.batch.value?.handle &&
      options.selectedEntityHandle.value &&
      options.selectedSourceHandle.value,
    ),
  )
  const canSaveTemplate = computed(
    () =>
      canUseTemplates.value &&
      templateTitle.value.trim().length > 0 &&
      options.hasTemplateContent.value &&
      !isSavingTemplate.value,
  )

  function clearSelectedTemplate(): void {
    loadRequestId += 1
    selectedTemplateHandle.value = null
    selectedTemplateRecord.value = null
    selectedTemplateSummary.value = null
  }

  async function selectTemplateRecord(record: SaplingGenericItem): Promise<void> {
    const handle = extractTemplateHandleNumber(record.handle)
    if (!handle) {
      clearSelectedTemplate()
      return
    }

    const requestId = ++loadRequestId
    const template = await ApiImportService.getTemplate(handle)
    if (requestId !== loadRequestId) {
      return
    }
    if (!template) {
      clearSelectedTemplate()
      return
    }

    selectedTemplateHandle.value = template.handle
    selectedTemplateSummary.value = template
    await applyTemplateSelection(template)
  }

  async function loadSelectedTemplateSummary(): Promise<ImportTemplateSummary | null> {
    const handle = getSelectedTemplateHandleNumber()
    return handle ? await ApiImportService.getTemplate(handle) : null
  }

  async function applyTemplateSelection(template: ImportTemplateSummary): Promise<void> {
    isApplyingTemplate.value = true
    try {
      const entityChanged = options.selectedEntityHandle.value !== template.entityHandle
      const sourceChanged = options.selectedSourceHandle.value !== template.sourceHandle

      options.selectedEntityHandle.value = template.entityHandle
      options.selectedSourceHandle.value = template.sourceHandle
      options.selectedTargetEntityRecord.value = template.entityHandle
        ? { handle: template.entityHandle }
        : null
      options.selectedSourceRecord.value = template.sourceHandle
        ? { handle: template.sourceHandle }
        : null

      if (entityChanged || sourceChanged) {
        await options.onScopeChanged(entityChanged, sourceChanged)
        selectedTemplateRecord.value = importTemplateSummaryToGenericItem(template)
      }

      selectedTemplateHandle.value = template.handle
      selectedTemplateSummary.value = template
      templateTitle.value = template.title
      options.applyTemplateConfiguration(template)
    } finally {
      isApplyingTemplate.value = false
    }
  }

  function applySelectedTemplate(): void {
    if (selectedTemplate.value) {
      void applyTemplateSelection(selectedTemplate.value)
      options.notifyTemplateLoaded(selectedTemplate.value)
    }
  }

  async function saveTemplate(): Promise<void> {
    if (
      !options.selectedEntityHandle.value ||
      !options.selectedSourceHandle.value ||
      !templateTitle.value.trim()
    ) {
      return
    }

    const existingHandle = getSelectedTemplateHandleNumber()
    const payload: SaveImportTemplatePayload = {
      ...options.buildTemplatePayload(),
      handle: existingHandle,
      title: templateTitle.value.trim(),
      isActive: true,
    }

    try {
      isSavingTemplate.value = true
      const savedTemplate = existingHandle
        ? await ApiImportService.updateTemplate(existingHandle, payload)
        : await ApiImportService.saveTemplate(payload)
      selectedTemplateHandle.value = savedTemplate.handle
      selectedTemplateSummary.value = savedTemplate
      selectedTemplateRecord.value = importTemplateSummaryToGenericItem(savedTemplate)
      templateTitle.value = savedTemplate.title
      options.applySavedMapping(savedTemplate)
      options.notifyTemplateSaved(savedTemplate)
    } catch {
      // Shared API errors already surface through the message center.
    } finally {
      isSavingTemplate.value = false
    }
  }

  function getSelectedTemplateHandleNumber(): number | null {
    return extractTemplateHandleNumber(selectedTemplateHandle.value)
  }

  return {
    selectedTemplateHandle,
    selectedTemplateRecord,
    selectedTemplateSummary,
    selectedTemplate,
    selectedTemplatePlaceholder,
    templateTitle,
    templateFilter,
    canSelectTemplates,
    canUseTemplates,
    canSaveTemplate,
    isSavingTemplate,
    isApplyingTemplate,
    clearSelectedTemplate,
    selectTemplateRecord,
    loadSelectedTemplateSummary,
    applyTemplateSelection,
    applySelectedTemplate,
    saveTemplate,
    getSelectedTemplateHandleNumber,
  }
}

function extractTemplateHandleNumber(value: unknown): number | null {
  if (value === null || value === '') {
    return null
  }
  const handle = Number(value)
  return Number.isFinite(handle) ? Math.trunc(handle) : null
}

export function importTemplateSummaryToGenericItem(
  template: ImportTemplateSummary,
): SaplingGenericItem {
  return {
    ...template,
    source: { handle: template.sourceHandle },
    targetEntity: { handle: template.entityHandle },
  }
}
