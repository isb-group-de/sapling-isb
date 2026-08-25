import { computed, reactive, type ComputedRef, type Ref } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import ApiGenericService from '@/services/api.generic.service'
import ApiImportService, {
  type ImportBatchSummary,
  type ImportValueMappingFallback,
} from '@/services/api.import.service'

const SOURCE_VALUE_LIMIT = 100

export type ImportValueMappingState = {
  targetField: string
  values: Record<string, unknown>
  fallback: ImportValueMappingFallback
}

export interface SaplingImportValueMappingOptions {
  batch: Ref<ImportBatchSummary | null>
  importableFields: ComputedRef<EntityTemplate[]>
  fieldMappings: Record<string, string | null>
  clearAiSuggestionFieldDetail: (targetField: string) => void
  fieldLabel: (targetField: string) => string
  usedLabel: () => string
}

export function normalizeImportValueMappingKey(value: unknown): string {
  return String(value ?? '').trim()
}

export function useSaplingImportValueMappings(options: SaplingImportValueMappingOptions) {
  const valueMappings = reactive<Record<string, ImportValueMappingState>>({})
  const sourceValueOptions = reactive<Record<string, string[]>>({})
  const referenceValueItems = reactive<
    Record<string, Record<string, SaplingGenericItem | null | undefined>>
  >({})
  const valueMappingDialog = reactive({
    visible: false,
    targetField: null as string | null,
    loading: false,
  })
  let valueMappingLoadRequest = 0

  const currentValueMappingField = computed(() =>
    options.importableFields.value.find((field) => field.name === valueMappingDialog.targetField),
  )
  const currentValueMapping = computed(() =>
    valueMappingDialog.targetField ? valueMappings[valueMappingDialog.targetField] : null,
  )
  const currentValueMappingSourceValues = computed(() => {
    if (!currentValueMappingField.value) {
      return []
    }

    return mergeSourceValues(
      sourceValuesForField(currentValueMappingField.value),
      Object.keys(currentValueMapping.value?.values ?? {}),
    )
  })
  const currentValueMappingReferenceItems = computed(() =>
    currentValueMappingField.value
      ? (referenceItemsForField(currentValueMappingField.value) ?? {})
      : {},
  )

  function onFieldMappingChange(targetField: string): void {
    options.clearAiSuggestionFieldDetail(targetField)
    delete sourceValueOptions[targetField]
    const field = options.importableFields.value.find((entry) => entry.name === targetField)
    const mapping = valueMappings[targetField]
    if (field && mapping) {
      void pruneValueMappingForField(field, mapping)
    }
  }

  async function pruneValueMappingForField(
    field: EntityTemplate,
    mapping: ImportValueMappingState,
  ): Promise<void> {
    const sourceColumn = options.fieldMappings[field.name]
    if (!sourceColumn) {
      delete valueMappings[field.name]
      return
    }

    try {
      await loadSourceValuesForField(field)
    } catch {
      return
    }
    if (options.fieldMappings[field.name] !== sourceColumn) {
      return
    }

    const validSourceValues = new Set(sourceValuesForField(field))
    mapping.values = Object.fromEntries(
      Object.entries(mapping.values).filter(([sourceValue]) => validSourceValues.has(sourceValue)),
    )
    if (Object.keys(mapping.values).length === 0) {
      delete valueMappings[field.name]
    }
  }

  async function openValueMapping(field: EntityTemplate): Promise<void> {
    if (!field.name || !options.fieldMappings[field.name]) {
      return
    }

    ensureValueMapping(field.name)
    valueMappingDialog.targetField = field.name
    valueMappingDialog.visible = true
    valueMappingDialog.loading = true
    const request = ++valueMappingLoadRequest

    try {
      await Promise.allSettled([
        loadSourceValuesForField(field),
        loadReferenceItemsForValueMapping(field),
      ])
    } finally {
      if (request === valueMappingLoadRequest) {
        valueMappingDialog.loading = false
      }
    }
  }

  async function loadReferenceItemsForValueMapping(field: EntityTemplate): Promise<void> {
    if (!field.isReference || !field.referenceName) {
      return
    }
    const referenceName = field.referenceName

    const handles = Object.values(valueMappings[field.name]?.values ?? {})
      .map(normalizeImportValueMappingKey)
      .filter(Boolean)
    const missingHandles = Array.from(new Set(handles)).filter(
      (handle) => !(handle in getReferenceValueItemCache(referenceName)),
    )
    if (missingHandles.length === 0) {
      return
    }

    const cache = getReferenceValueItemCache(referenceName)
    try {
      const response = await ApiGenericService.findByHandles<SaplingGenericItem>(
        referenceName,
        missingHandles,
        { relations: ['m:1'] },
      )
      const itemsByHandle = new Map(
        response
          .map((item) => [normalizeImportValueMappingKey(item.handle), item] as const)
          .filter(([handle]) => handle.length > 0),
      )
      missingHandles.forEach((handle) => {
        cache[handle] = itemsByHandle.get(handle) ?? null
      })
    } catch {
      missingHandles.forEach((handle) => {
        cache[handle] = null
      })
    }
  }

  function referenceItemsForField(
    field: EntityTemplate | null | undefined,
  ): Record<string, SaplingGenericItem | null | undefined> | undefined {
    return field?.isReference && field.referenceName
      ? getReferenceValueItemCache(field.referenceName)
      : undefined
  }

  function getReferenceValueItemCache(
    referenceName: string,
  ): Record<string, SaplingGenericItem | null | undefined> {
    referenceValueItems[referenceName] ??= {}
    return referenceValueItems[referenceName]
  }

  async function loadSourceValuesForField(field: EntityTemplate): Promise<void> {
    const sourceColumn = options.fieldMappings[field.name]
    if (!options.batch.value?.handle || !sourceColumn) {
      sourceValueOptions[field.name] = sourceValuesForField(field)
      return
    }

    const response = await ApiImportService.getBatchSourceValues(options.batch.value.handle, {
      column: sourceColumn,
      limit: SOURCE_VALUE_LIMIT,
    })
    sourceValueOptions[field.name] = response.values
  }

  function closeValueMapping(): void {
    valueMappingLoadRequest += 1
    valueMappingDialog.visible = false
    valueMappingDialog.targetField = null
    valueMappingDialog.loading = false
  }

  function clearCurrentValueMapping(): void {
    if (valueMappingDialog.targetField) {
      delete valueMappings[valueMappingDialog.targetField]
      closeValueMapping()
    }
  }

  function updateCurrentValueMappingFallback(value: ImportValueMappingFallback): void {
    if (currentValueMapping.value) {
      currentValueMapping.value.fallback = value
    }
  }

  function updateCurrentValueMappingValue(sourceValue: string, value: unknown): void {
    if (currentValueMapping.value) {
      currentValueMapping.value.values[sourceValue] = value
    }
  }

  function ensureValueMapping(targetField: string): ImportValueMappingState {
    valueMappings[targetField] ??= {
      targetField,
      values: {},
      fallback: 'keep',
    }
    return valueMappings[targetField]
  }

  function hasValueMapping(targetField: string): boolean {
    return Boolean(
      valueMappings[targetField] && Object.keys(valueMappings[targetField].values).length,
    )
  }

  function getSourceColumnOptionValue(item: unknown): string {
    if (typeof item === 'string') {
      return item
    }
    if (item && typeof item === 'object') {
      const source = item as { raw?: unknown; value?: unknown; title?: unknown }
      return (
        [source.raw, source.value, source.title].find(
          (value): value is string => typeof value === 'string',
        ) ?? ''
      )
    }
    return ''
  }

  function getSourceColumnOptionTitle(item: unknown): string {
    return getSourceColumnOptionValue(item) || String(item ?? '')
  }

  function sourceColumnUsageLabels(sourceColumn: string): string[] {
    return sourceColumn
      ? Object.entries(options.fieldMappings)
          .filter(([, mappedColumn]) => mappedColumn === sourceColumn)
          .map(([targetField]) => options.fieldLabel(targetField))
      : []
  }

  function sourceColumnUsageSummary(sourceColumn: string): string {
    const labels = sourceColumnUsageLabels(sourceColumn)
    return labels.length <= 1 ? options.usedLabel() : `${options.usedLabel()} ${labels.length}x`
  }

  function sourceValuesForField(field: EntityTemplate): string[] {
    if (sourceValueOptions[field.name]) {
      return sourceValueOptions[field.name]
    }
    const sourceColumn = options.fieldMappings[field.name]
    if (!sourceColumn) {
      return []
    }

    const rows = [
      ...(options.batch.value?.rows.map((row) => row.rawData) ?? []),
      ...(options.batch.value?.sampleRows ?? []),
    ]
    return Array.from(
      new Set(rows.map((row) => normalizeImportValueMappingKey(row[sourceColumn])).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right))
  }

  function resetValueMappings(): void {
    Object.keys(valueMappings).forEach((key) => delete valueMappings[key])
    Object.keys(sourceValueOptions).forEach((key) => delete sourceValueOptions[key])
    Object.keys(referenceValueItems).forEach((key) => delete referenceValueItems[key])
    closeValueMapping()
  }

  return {
    valueMappings,
    valueMappingDialog,
    currentValueMapping,
    currentValueMappingField,
    currentValueMappingSourceValues,
    currentValueMappingReferenceItems,
    onFieldMappingChange,
    openValueMapping,
    referenceItemsForField,
    closeValueMapping,
    clearCurrentValueMapping,
    updateCurrentValueMappingFallback,
    updateCurrentValueMappingValue,
    hasValueMapping,
    getSourceColumnOptionValue,
    getSourceColumnOptionTitle,
    sourceColumnUsageLabels,
    sourceColumnUsageSummary,
    resetValueMappings,
  }
}

function mergeSourceValues(...groups: string[][]): string[] {
  return Array.from(
    new Set(groups.flat().map(normalizeImportValueMappingKey).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right))
}
