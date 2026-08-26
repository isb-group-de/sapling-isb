import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ApiFormConfigService from '@/services/api.form-config.service'
import type { SaplingFormConfigPayload } from '@/entity/structure'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'

interface UseSaplingFormConfigTransferOptions {
  selectedEntityHandle: Ref<string>
  selectedConfigHandle: Ref<number | null>
  configName: Ref<string>
  draftConfig: Ref<SaplingFormConfigPayload>
  loadEntityContext: () => Promise<void>
  applyConfig: (config: SaplingFormConfigPayload) => void
}

/** Handles JSON import, validation, and export for form-configuration editors. */
export function useSaplingFormConfigTransfer({
  selectedEntityHandle,
  selectedConfigHandle,
  configName,
  draftConfig,
  loadEntityContext,
  applyConfig,
}: UseSaplingFormConfigTransferOptions) {
  const { t } = useI18n()
  const { pushMessage } = useSaplingMessageCenter()
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

    let parsed: SaplingFormConfigPayload
    try {
      parsed = JSON.parse(await file.text()) as SaplingFormConfigPayload
    } catch (error: unknown) {
      pushMessage('error', 'formConfig.importFailed', '', 'formConfig', error)
      return
    }

    try {
      if (parsed.entityHandle && parsed.entityHandle !== selectedEntityHandle.value) {
        selectedEntityHandle.value = parsed.entityHandle
        await loadEntityContext()
      }

      configName.value = file.name.replace(/\.json$/i, '')
      selectedConfigHandle.value = null
      const validation = await ApiFormConfigService.validate(selectedEntityHandle.value, parsed)
      if (!validation.isValid) {
        pushMessage(
          'warning',
          t('formConfig.validationSummary', {
            errors: validation.errors.length,
            warnings: validation.warnings.length,
          }),
          '',
          'formConfig',
          validation,
        )
        return
      }

      applyConfig(validation.normalizedConfig)
    } catch {
      return
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
