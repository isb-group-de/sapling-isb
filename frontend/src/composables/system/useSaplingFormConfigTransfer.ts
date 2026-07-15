import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ApiFormConfigService from '@/services/api.form-config.service'
import type { SaplingFormConfigPayload } from '@/entity/structure'

interface UseSaplingFormConfigTransferOptions {
  selectedEntityHandle: Ref<string>
  selectedConfigHandle: Ref<number | null>
  configName: Ref<string>
  draftConfig: Ref<SaplingFormConfigPayload>
  errorMessage: Ref<string>
  loadEntityContext: () => Promise<void>
  applyFields: (fields: SaplingFormConfigPayload['fields']) => void
}

/** Handles JSON import, validation, and export for form-configuration editors. */
export function useSaplingFormConfigTransfer({
  selectedEntityHandle,
  selectedConfigHandle,
  configName,
  draftConfig,
  errorMessage,
  loadEntityContext,
  applyFields,
}: UseSaplingFormConfigTransferOptions) {
  const { t } = useI18n()
  const fileInputRef = ref<HTMLInputElement | null>(null)

  function openImportFile(): void {
    fileInputRef.value?.click()
  }

  async function onImportFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) {
      return
    }

    try {
      const parsed = JSON.parse(await file.text()) as SaplingFormConfigPayload
      if (parsed.entityHandle && parsed.entityHandle !== selectedEntityHandle.value) {
        selectedEntityHandle.value = parsed.entityHandle
        await loadEntityContext()
      }

      configName.value = file.name.replace(/\.json$/i, '')
      selectedConfigHandle.value = null
      const validation = await ApiFormConfigService.validate(selectedEntityHandle.value, parsed)
      if (!validation.isValid) {
        errorMessage.value = t('formConfig.validationSummary', {
          errors: validation.errors.length,
          warnings: validation.warnings.length,
        })
        return
      }

      applyFields(validation.normalizedConfig.fields ?? parsed.fields ?? {})
    } catch {
      errorMessage.value = t('formConfig.importFailed')
    }
  }

  function exportDraft(): void {
    const blob = new Blob([JSON.stringify(draftConfig.value, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selectedEntityHandle.value || 'sapling'}-form-config.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return {
    fileInputRef,
    openImportFile,
    onImportFileChange,
    exportDraft,
  }
}
