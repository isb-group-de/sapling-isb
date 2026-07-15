import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaplingFormConfigPayload } from '@/entity/structure'

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  loadEntityContext: vi.fn(),
  applyFields: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: unknown) => (values ? `${key}:${JSON.stringify(values)}` : key),
  }),
}))

vi.mock('@/services/api.form-config.service', () => ({
  default: { validate: mocks.validate },
}))

import { useSaplingFormConfigTransfer } from '../useSaplingFormConfigTransfer'

const importedConfig: SaplingFormConfigPayload = {
  schema: 'sapling.form-config.v1',
  entityHandle: 'person',
  fields: { firstName: { visible: true } },
}

function createSubject() {
  const selectedEntityHandle = ref('ticket')
  const selectedConfigHandle = ref<number | null>(12)
  const configName = ref('Existing')
  const draftConfig = ref<SaplingFormConfigPayload>({
    schema: 'sapling.form-config.v1',
    entityHandle: 'ticket',
    fields: {},
  })
  const errorMessage = ref('')

  return {
    selectedEntityHandle,
    selectedConfigHandle,
    configName,
    errorMessage,
    subject: useSaplingFormConfigTransfer({
      selectedEntityHandle,
      selectedConfigHandle,
      configName,
      draftConfig,
      errorMessage,
      loadEntityContext: mocks.loadEntityContext,
      applyFields: mocks.applyFields,
    }),
  }
}

function createFileEvent(payload: unknown, name = 'person-layout.json'): Event {
  const input = {
    files: [
      {
        name,
        text: vi.fn().mockResolvedValue(JSON.stringify(payload)),
      },
    ],
    value: name,
  }
  return { target: input } as unknown as Event
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loadEntityContext.mockResolvedValue(undefined)
  mocks.validate.mockResolvedValue({
    isValid: true,
    errors: [],
    warnings: [],
    normalizedConfig: importedConfig,
  })
})

describe('useSaplingFormConfigTransfer', () => {
  it('switches entity context, validates, and applies imported fields', async () => {
    const state = createSubject()

    await state.subject.onImportFileChange(createFileEvent(importedConfig))

    expect(state.selectedEntityHandle.value).toBe('person')
    expect(mocks.loadEntityContext).toHaveBeenCalledOnce()
    expect(mocks.validate).toHaveBeenCalledWith('person', importedConfig)
    expect(mocks.applyFields).toHaveBeenCalledWith(importedConfig.fields)
    expect(state.configName.value).toBe('person-layout')
    expect(state.selectedConfigHandle.value).toBeNull()
  })

  it('reports validation summaries without applying invalid fields', async () => {
    mocks.validate.mockResolvedValue({
      isValid: false,
      errors: [{ path: 'fields' }],
      warnings: [{ path: 'entityHandle' }],
      normalizedConfig: importedConfig,
    })
    const state = createSubject()

    await state.subject.onImportFileChange(createFileEvent(importedConfig))

    expect(mocks.applyFields).not.toHaveBeenCalled()
    expect(state.errorMessage.value).toContain('formConfig.validationSummary')
    expect(state.errorMessage.value).toContain('"errors":1')
  })
})
