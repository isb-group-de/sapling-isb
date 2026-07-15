import type { ComputedRef, Ref } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import type {
  ImportFieldDefault,
  ImportFieldMapping,
  ImportGenericReferenceMapping,
  ImportRelationMapping,
  ImportRelationMappingMode,
  ImportUniqueConflictStrategy,
  ImportUniqueConflictStrategyMode,
  ImportValueMapping,
  ImportValueMappingFallback,
} from '@/services/api.import.service'
import {
  normalizeImportValueMappingKey,
  type ImportValueMappingState,
} from '@/composables/import/useSaplingImportValueMappings'

export type ImportMappingConfiguration =
  | {
      mappings?: ImportFieldMapping[]
      fieldDefaults?: ImportFieldDefault[]
      relationMappings?: ImportRelationMapping[]
      valueMappings?: ImportValueMapping[]
      uniqueConflictStrategies?: ImportUniqueConflictStrategy[]
    }
  | null
  | undefined

export interface SaplingImportMappingConfigurationOptions {
  importableFields: ComputedRef<EntityTemplate[]>
  headerOptions: ComputedRef<string[]>
  selectedSourceHandle: Ref<string | null>
  fieldMappings: Record<string, string | null>
  fieldDefaults: Record<string, unknown>
  relationMappingModes: Record<string, ImportRelationMappingMode | null>
  relationMappingColumns: Record<string, string[]>
  uniqueConflictStrategies: Record<string, ImportUniqueConflictStrategyMode>
  valueMappings: Record<string, ImportValueMappingState>
}

export function useSaplingImportMappingConfiguration(
  options: SaplingImportMappingConfigurationOptions,
) {
  function initializeMappingConfiguration(): void {
    clearMappingConfiguration()

    for (const field of options.importableFields.value) {
      const matchedHeader = options.headerOptions.value.find(
        (header) => normalizeName(header) === normalizeName(field.name),
      )
      options.fieldMappings[field.name] = matchedHeader ?? null
      options.fieldDefaults[field.name] = getTemplateDefaultValue(field)
      if (isUniqueConflictField(field)) {
        options.uniqueConflictStrategies[field.name] = 'error'
      }
      if (field.isReference && field.referenceName) {
        options.relationMappingModes[field.name] = null
        options.relationMappingColumns[field.name] = []
      }
    }
  }

  function clearMappingConfiguration(): void {
    clearRecord(options.fieldMappings)
    clearRecord(options.fieldDefaults)
    clearRecord(options.relationMappingModes)
    clearRecord(options.relationMappingColumns)
    clearRecord(options.uniqueConflictStrategies)
    clearRecord(options.valueMappings)
  }

  function applyValueMappings(mappingConfiguration: ImportMappingConfiguration): void {
    clearRecord(options.valueMappings)

    for (const mapping of mappingConfiguration?.valueMappings ?? []) {
      if (!mapping.targetField || !options.fieldMappings[mapping.targetField]) {
        continue
      }

      options.valueMappings[mapping.targetField] = {
        targetField: mapping.targetField,
        values: { ...(mapping.values ?? {}) },
        fallback: normalizeValueMappingFallback(mapping.fallback),
      }
    }
  }

  function applyMappingConfiguration(mappingConfiguration: ImportMappingConfiguration): void {
    clearMappingConfiguration()

    for (const field of options.importableFields.value) {
      options.fieldMappings[field.name] = null
      options.fieldDefaults[field.name] = getTemplateDefaultValue(field)
      if (isUniqueConflictField(field)) {
        options.uniqueConflictStrategies[field.name] = 'error'
      }
      if (field.isReference && field.referenceName) {
        options.relationMappingModes[field.name] = null
        options.relationMappingColumns[field.name] = []
      }
    }

    for (const mapping of mappingConfiguration?.mappings ?? []) {
      if (!mapping.targetField || !mapping.sourceColumn) {
        continue
      }
      options.fieldMappings[mapping.targetField] = options.headerOptions.value.includes(
        mapping.sourceColumn,
      )
        ? mapping.sourceColumn
        : null
    }

    for (const fieldDefault of mappingConfiguration?.fieldDefaults ?? []) {
      if (!fieldDefault.targetField || !(fieldDefault.targetField in options.fieldDefaults)) {
        continue
      }
      options.fieldDefaults[fieldDefault.targetField] = fieldDefault.value ?? null
    }

    for (const relationMapping of mappingConfiguration?.relationMappings ?? []) {
      if (
        !relationMapping.targetField ||
        !(relationMapping.targetField in options.relationMappingModes) ||
        !['handle', 'value', 'externalKey'].includes(relationMapping.mode)
      ) {
        continue
      }

      options.relationMappingModes[relationMapping.targetField] = relationMapping.mode
      options.relationMappingColumns[relationMapping.targetField] = filterExistingColumns(
        relationMapping.sourceColumns?.length
          ? relationMapping.sourceColumns
          : relationMapping.sourceColumn
            ? [relationMapping.sourceColumn]
            : [],
      )
    }

    for (const strategy of mappingConfiguration?.uniqueConflictStrategies ?? []) {
      if (
        !strategy.targetField ||
        !(strategy.targetField in options.uniqueConflictStrategies) ||
        !['error', 'appendExternalKey'].includes(strategy.strategy)
      ) {
        continue
      }
      options.uniqueConflictStrategies[strategy.targetField] = strategy.strategy
    }

    applyValueMappings(mappingConfiguration)
  }

  function buildFieldMappings(): ImportFieldMapping[] {
    return Object.entries(options.fieldMappings)
      .filter(([, sourceColumn]) => Boolean(sourceColumn))
      .map(([targetField, sourceColumn]) => ({
        targetField,
        sourceColumn: sourceColumn as string,
      }))
  }

  function buildFieldDefaults(): ImportFieldDefault[] {
    return Object.entries(options.fieldDefaults)
      .filter(([, value]) => hasFieldDefaultValue(value))
      .map(([targetField, value]) => ({ targetField, value }))
  }

  function buildRelationMappings(): ImportRelationMapping[] {
    return Object.entries(options.relationMappingModes).reduce<ImportRelationMapping[]>(
      (mappings, [targetField, mode]) => {
        const columns = normalizeSelectedColumns(options.relationMappingColumns[targetField] ?? [])
        if (!mode || columns.length === 0) {
          return mappings
        }

        mappings.push({
          targetField,
          mode,
          sourceColumn: columns[0],
          sourceColumns: mode === 'externalKey' ? columns : [columns[0]],
          sourceHandle: options.selectedSourceHandle.value,
        })
        return mappings
      },
      [],
    )
  }

  function buildValueMappings(): ImportValueMapping[] {
    return Object.values(options.valueMappings)
      .map((mapping) => ({
        targetField: mapping.targetField,
        values: Object.fromEntries(
          Object.entries(mapping.values).filter(([, value]) => value !== null && value !== ''),
        ),
        fallback: normalizeValueMappingFallback(mapping.fallback),
      }))
      .filter((mapping) => Object.keys(mapping.values).length > 0)
  }

  function buildUniqueConflictStrategies(): ImportUniqueConflictStrategy[] {
    return Object.entries(options.uniqueConflictStrategies)
      .filter(([, strategy]) => strategy !== 'error')
      .map(([targetField, strategy]) => ({ targetField, strategy }))
  }

  function filterExistingColumns(columns: string[]): string[] {
    return normalizeSelectedColumns(
      columns.filter((column) => options.headerOptions.value.includes(column)),
    )
  }

  function normalizeExternalColumns(columns: string[]): string[] {
    return normalizeSelectedColumns(columns)
  }

  function normalizeRelationMappingColumns(targetField: string): void {
    options.relationMappingColumns[targetField] = normalizeSelectedColumns(
      options.relationMappingColumns[targetField] ?? [],
    )
  }

  function updateFieldMapping(targetField: string, value: string | null): void {
    options.fieldMappings[targetField] = value
  }

  function updateFieldDefault(targetField: string, value: unknown): void {
    options.fieldDefaults[targetField] = value
  }

  function updateRelationMappingMode(
    targetField: string,
    value: ImportRelationMappingMode | null,
  ): void {
    options.relationMappingModes[targetField] = value
  }

  function updateRelationMappingColumns(targetField: string, value: string[]): void {
    options.relationMappingColumns[targetField] = value
  }

  function updateUniqueConflictStrategy(
    targetField: string,
    value: ImportUniqueConflictStrategyMode,
  ): void {
    options.uniqueConflictStrategies[targetField] = value
  }

  return {
    initializeMappingConfiguration,
    clearMappingConfiguration,
    applyValueMappings,
    applyMappingConfiguration,
    buildFieldMappings,
    buildFieldDefaults,
    buildRelationMappings,
    buildValueMappings,
    buildUniqueConflictStrategies,
    filterExistingColumns,
    normalizeExternalColumns,
    normalizeRelationMappingColumns,
    updateFieldMapping,
    updateFieldDefault,
    updateRelationMappingMode,
    updateRelationMappingColumns,
    updateUniqueConflictStrategy,
  }
}

export function mergeImportMappingConfiguration(
  baseConfiguration: ImportMappingConfiguration,
  overrideConfiguration: ImportMappingConfiguration,
): ImportMappingConfiguration {
  if (!baseConfiguration) {
    return overrideConfiguration
  }
  if (!overrideConfiguration) {
    return baseConfiguration
  }

  return {
    ...baseConfiguration,
    ...overrideConfiguration,
    valueMappings: mergeValueMappings(
      baseConfiguration.valueMappings ?? [],
      overrideConfiguration.valueMappings ?? [],
    ),
  }
}

export function normalizeGenericReferenceMapping(
  value: unknown,
): ImportGenericReferenceMapping | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const mapping = value as Partial<ImportGenericReferenceMapping>
  if (!mapping.entityHandle || !Array.isArray(mapping.keyColumns)) {
    return null
  }

  return {
    entityHandle: mapping.entityHandle,
    sourceHandle: mapping.sourceHandle ?? null,
    keyColumns: mapping.keyColumns,
  }
}

export function normalizeSelectedHandle(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const normalizedValue = String(value).trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

export function hasFieldDefaultValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return value !== null && typeof value !== 'undefined' && value !== ''
}

function mergeValueMappings(
  baseMappings: ImportValueMapping[],
  overrideMappings: ImportValueMapping[],
): ImportValueMapping[] {
  const merged = new Map<string, ImportValueMapping>()

  for (const mapping of normalizeImportValueMappings(baseMappings)) {
    merged.set(mapping.targetField, { ...mapping, values: { ...mapping.values } })
  }

  for (const mapping of normalizeImportValueMappings(overrideMappings)) {
    const existing = merged.get(mapping.targetField)
    merged.set(mapping.targetField, {
      targetField: mapping.targetField,
      values: { ...(existing?.values ?? {}), ...mapping.values },
      fallback: mapping.fallback ?? existing?.fallback,
    })
  }

  return [...merged.values()]
}

function normalizeImportValueMappings(mappings: ImportValueMapping[]): ImportValueMapping[] {
  return mappings
    .map((mapping) => ({
      targetField: normalizeImportValueMappingKey(mapping.targetField),
      values: Object.fromEntries(
        Object.entries(mapping.values ?? {})
          .map(([sourceValue, targetValue]) => [
            normalizeImportValueMappingKey(sourceValue),
            targetValue,
          ])
          .filter(
            ([sourceValue, targetValue]) =>
              typeof sourceValue === 'string' &&
              sourceValue.length > 0 &&
              targetValue !== null &&
              targetValue !== '',
          ),
      ),
      fallback: normalizeValueMappingFallback(mapping.fallback),
    }))
    .filter((mapping) => mapping.targetField && Object.keys(mapping.values).length > 0)
}

function getTemplateDefaultValue(field: EntityTemplate): unknown {
  if (field.name === 'handle' || field.isPrimaryKey || field.isAutoIncrement) {
    return null
  }

  const defaultValue = hasFieldDefaultValue(field.default) ? field.default : field.defaultRaw
  if (!hasFieldDefaultValue(defaultValue) || isGeneratedDefaultValue(defaultValue)) {
    return null
  }
  return normalizeTemplateDefaultValue(field, cloneTemplateDefaultValue(defaultValue))
}

function cloneTemplateDefaultValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value]
  }
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) }
  }
  return value
}

function normalizeTemplateDefaultValue(field: EntityTemplate, value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const fieldType = String(field.type ?? '').toLowerCase()
  const trimmedValue = value.trim()
  if (fieldType.includes('boolean')) {
    if (trimmedValue.toLowerCase() === 'true') return true
    if (trimmedValue.toLowerCase() === 'false') return false
  }
  if (/(number|integer|float|double|decimal)/.test(fieldType) && trimmedValue !== '') {
    const numericValue = Number(trimmedValue)
    if (Number.isFinite(numericValue)) return numericValue
  }
  return trimmedValue
}

function isGeneratedDefaultValue(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^(now\(\)|current_|gen_random_|uuid_generate_|nextval\()/i.test(value.trim())
  )
}

function isUniqueConflictField(field: EntityTemplate): boolean {
  return Boolean(
    field.isUnique &&
    !field.isPrimaryKey &&
    !field.isReference &&
    ['string', 'text', 'varchar'].includes(field.type),
  )
}

function normalizeValueMappingFallback(
  fallback: ImportValueMappingFallback | undefined,
): ImportValueMappingFallback {
  return fallback === 'empty' || fallback === 'error' ? fallback : 'keep'
}

function normalizeSelectedColumns(columns: string[]): string[] {
  return Array.from(new Set(columns.map((column) => column.trim()).filter(Boolean)))
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function clearRecord(record: Record<string, unknown>): void {
  Object.keys(record).forEach((key) => delete record[key])
}
