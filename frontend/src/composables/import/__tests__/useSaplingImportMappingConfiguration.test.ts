import { computed, reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { EntityTemplate } from '@/entity/structure'
import {
  mergeImportMappingConfiguration,
  normalizeGenericReferenceMapping,
  useSaplingImportMappingConfiguration,
} from '@/composables/import/useSaplingImportMappingConfiguration'

function field(name: string, overrides: Partial<EntityTemplate> = {}): EntityTemplate {
  return {
    name,
    type: 'string',
    isPrimaryKey: false,
    isAutoIncrement: false,
    isUnique: false,
    isReference: false,
    referenceName: '',
    ...overrides,
  } as EntityTemplate
}

function setup() {
  const importableFields = computed(() => [
    field('title', { defaultRaw: 'Draft' }),
    field('customer', { isReference: true, referenceName: 'person' }),
    field('code', { isUnique: true }),
  ])
  const headerOptions = computed(() => ['Title', 'Customer Id', 'Code'])
  const selectedSourceHandle = ref<string | null>('erp')
  const fieldMappings = reactive<Record<string, string | null>>({})
  const fieldDefaults = reactive<Record<string, unknown>>({})
  const relationMappingModes = reactive<Record<string, 'handle' | 'value' | 'externalKey' | null>>(
    {},
  )
  const relationMappingColumns = reactive<Record<string, string[]>>({})
  const uniqueConflictStrategies = reactive<Record<string, 'error' | 'appendExternalKey'>>({})
  const valueMappings = reactive<
    Record<string, { targetField: string; values: Record<string, unknown>; fallback: 'keep' }>
  >({})

  const mapping = useSaplingImportMappingConfiguration({
    importableFields,
    headerOptions,
    selectedSourceHandle,
    fieldMappings,
    fieldDefaults,
    relationMappingModes,
    relationMappingColumns,
    uniqueConflictStrategies,
    valueMappings,
  })

  return {
    mapping,
    fieldMappings,
    fieldDefaults,
    relationMappingModes,
    relationMappingColumns,
    uniqueConflictStrategies,
    valueMappings,
  }
}

describe('useSaplingImportMappingConfiguration', () => {
  it('initializes matching headers, defaults, relations, and unique strategies', () => {
    const state = setup()

    state.mapping.initializeMappingConfiguration()

    expect(state.fieldMappings).toEqual({ title: 'Title', customer: null, code: 'Code' })
    expect(state.fieldDefaults.title).toBe('Draft')
    expect(state.relationMappingModes.customer).toBeNull()
    expect(state.relationMappingColumns.customer).toEqual([])
    expect(state.uniqueConflictStrategies.code).toBe('error')
  })

  it('applies only valid columns and serializes the configured mapping', () => {
    const state = setup()

    state.mapping.applyMappingConfiguration({
      mappings: [
        { targetField: 'title', sourceColumn: 'Title' },
        { targetField: 'code', sourceColumn: 'Missing' },
      ],
      fieldDefaults: [{ targetField: 'customer', value: 42 }],
      relationMappings: [
        {
          targetField: 'customer',
          mode: 'externalKey',
          sourceColumn: 'Customer Id',
          sourceColumns: ['Customer Id', 'Missing'],
        },
      ],
      valueMappings: [
        { targetField: 'title', values: { old: 'new', ignored: '' }, fallback: 'error' },
      ],
      uniqueConflictStrategies: [{ targetField: 'code', strategy: 'appendExternalKey' }],
    })

    expect(state.fieldMappings).toMatchObject({ title: 'Title', code: null })
    expect(state.mapping.buildFieldDefaults()).toContainEqual({
      targetField: 'customer',
      value: 42,
    })
    expect(state.mapping.buildRelationMappings()).toEqual([
      {
        targetField: 'customer',
        mode: 'externalKey',
        sourceColumn: 'Customer Id',
        sourceColumns: ['Customer Id'],
        sourceHandle: 'erp',
      },
    ])
    expect(state.mapping.buildValueMappings()).toEqual([
      { targetField: 'title', values: { old: 'new' }, fallback: 'error' },
    ])
    expect(state.mapping.buildUniqueConflictStrategies()).toEqual([
      { targetField: 'code', strategy: 'appendExternalKey' },
    ])
  })

  it('merges normalized value mappings while preserving override precedence', () => {
    const merged = mergeImportMappingConfiguration(
      { valueMappings: [{ targetField: ' status ', values: { open: 1 }, fallback: 'keep' }] },
      {
        valueMappings: [
          { targetField: 'status', values: { open: 2, closed: 3 }, fallback: 'error' },
        ],
      },
    )

    expect(merged?.valueMappings).toEqual([
      { targetField: 'status', values: { open: 2, closed: 3 }, fallback: 'error' },
    ])
    expect(
      normalizeGenericReferenceMapping({ entityHandle: 'person', keyColumns: ['id'] }),
    ).toEqual({ entityHandle: 'person', sourceHandle: null, keyColumns: ['id'] })
  })
})
