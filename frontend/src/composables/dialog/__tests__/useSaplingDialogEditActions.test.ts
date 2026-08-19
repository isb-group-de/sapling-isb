import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { SaplingDialogEditEmit, VuetifyFormRef } from '../saplingDialogEdit.types'
import { useSaplingDialogEditActions } from '../useSaplingDialogEditActions'

describe('useSaplingDialogEditActions', () => {
  it('submits a pristine prefilled create record and cancels it without a discard prompt', async () => {
    const emitMock = vi.fn()
    const validate = vi.fn().mockResolvedValue({ valid: true })
    const payload = { name: 'Vorausgefüllte Vorlage' }
    const actions = useSaplingDialogEditActions({
      mode: computed(() => 'create'),
      entity: computed(() => null),
      isDirty: computed(() => false),
      canSubmit: computed(() => true),
      formRef: ref<VuetifyFormRef | null>({ validate }),
      activeTab: ref(0),
      emit: emitMock as unknown as SaplingDialogEditEmit,
      buildSavePayload: () => payload,
      syncInitialFormSnapshot: vi.fn(),
      resetRelationSelections: vi.fn(),
      initializeFormWithParentContext: vi.fn(),
    })

    await actions.saveAndClose()

    expect(validate).toHaveBeenCalledOnce()
    expect(emitMock).toHaveBeenCalledWith('save', payload, 'saveAndClose', expect.any(Object))

    actions.completeSave('saveAndClose')
    emitMock.mockClear()
    actions.cancel()

    expect(actions.unsavedChangesDialog.value).toBe(false)
    expect(emitMock).toHaveBeenNthCalledWith(1, 'update:modelValue', false)
    expect(emitMock).toHaveBeenNthCalledWith(2, 'cancel')
  })
})
