import type { ComputedRef, Ref } from 'vue'
import type {
  ImportFieldDefault,
  ImportFieldMapping,
  ImportGenericReferenceMapping,
  ImportRelationMapping,
  ImportTemplateSummary,
  ImportUniqueConflictStrategy,
  ImportValueMapping,
  SaveImportTemplatePayload,
} from '@/services/api.import.service'
import type { ImportMappingConfiguration } from '@/composables/import/useSaplingImportMappingConfiguration'

export interface SaplingImportConfigurationSessionOptions {
  selectedEntityHandle: Ref<string | null>
  selectedSourceHandle: Ref<string | null>
  externalKeyColumns: Ref<string[]>
  genericReferenceEntityHandle: Ref<string | null>
  genericReferenceKeyColumns: Ref<string[]>
  hasGenericReference: ComputedRef<boolean>
  initializeMappingConfiguration: () => void
  clearMappingConfiguration: () => void
  applyMappingConfiguration: (configuration: ImportMappingConfiguration) => void
  filterExistingColumns: (columns: string[]) => string[]
  normalizeExternalColumns: (columns: string[]) => string[]
  buildFieldMappings: () => ImportFieldMapping[]
  buildFieldDefaults: () => ImportFieldDefault[]
  buildRelationMappings: () => ImportRelationMapping[]
  buildValueMappings: () => ImportValueMapping[]
  buildUniqueConflictStrategies: () => ImportUniqueConflictStrategy[]
  resetAiSuggestion: () => void
  resetValueMappings: () => void
  getSelectedTemplateHandle: () => number | null
  getTemplateTitle: () => string
}

export function useSaplingImportConfigurationSession(
  options: SaplingImportConfigurationSessionOptions,
) {
  function initializeMappings(): void {
    options.resetAiSuggestion()
    options.resetValueMappings()
    options.initializeMappingConfiguration()
  }

  function clearMappingState(): void {
    options.resetAiSuggestion()
    options.resetValueMappings()
    options.clearMappingConfiguration()
  }

  function applyTemplate(template: ImportTemplateSummary): void {
    options.resetAiSuggestion()
    options.applyMappingConfiguration(template.mapping)
    options.externalKeyColumns.value = options.filterExistingColumns(
      template.externalKeyColumns ?? [],
    )
    options.genericReferenceEntityHandle.value =
      template.genericReferenceMapping?.entityHandle ?? null
    options.genericReferenceKeyColumns.value = options.filterExistingColumns(
      template.genericReferenceMapping?.keyColumns ?? [],
    )
  }

  function normalizeExternalKeyColumns(): void {
    options.externalKeyColumns.value = options.normalizeExternalColumns(
      options.externalKeyColumns.value,
    )
  }

  function normalizeGenericReferenceKeyColumns(): void {
    options.genericReferenceKeyColumns.value = options.normalizeExternalColumns(
      options.genericReferenceKeyColumns.value,
    )
  }

  function buildTemplatePayload(): SaveImportTemplatePayload {
    return {
      entityHandle: options.selectedEntityHandle.value ?? '',
      sourceHandle: options.selectedSourceHandle.value,
      templateHandle: options.getSelectedTemplateHandle(),
      keyColumns: options.externalKeyColumns.value,
      mappings: options.buildFieldMappings(),
      fieldDefaults: options.buildFieldDefaults(),
      relationMappings: options.buildRelationMappings(),
      valueMappings: options.buildValueMappings(),
      uniqueConflictStrategies: options.buildUniqueConflictStrategies(),
      genericReferenceMapping: buildGenericReferenceMapping(),
      title: options.getTemplateTitle().trim(),
    }
  }

  function buildGenericReferenceMapping(): ImportGenericReferenceMapping | null {
    if (
      !options.hasGenericReference.value ||
      !options.selectedSourceHandle.value ||
      !options.genericReferenceEntityHandle.value ||
      options.genericReferenceKeyColumns.value.length === 0
    ) {
      return null
    }
    return {
      entityHandle: options.genericReferenceEntityHandle.value,
      sourceHandle: options.selectedSourceHandle.value,
      keyColumns: options.genericReferenceKeyColumns.value,
    }
  }

  return {
    initializeMappings,
    clearMappingState,
    applyTemplate,
    normalizeExternalKeyColumns,
    normalizeGenericReferenceKeyColumns,
    buildTemplatePayload,
  }
}
