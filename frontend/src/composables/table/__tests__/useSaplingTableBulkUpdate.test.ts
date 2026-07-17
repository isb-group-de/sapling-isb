import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bulkUpdate: vi.fn(),
  pushMessage: vi.fn(),
  clearSelection: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: { bulkUpdate: mocks.bulkUpdate },
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

import { useSaplingTableBulkUpdate } from '../useSaplingTableBulkUpdate'

function createSubject() {
  const selectedItems = ref<Array<{ handle: number; updatedAt?: string }>>([
    { handle: 2, updatedAt: '2026-07-17T08:00:00.000Z' },
    { handle: 7, updatedAt: '2026-07-17T09:00:00.000Z' },
  ])
  const subject = useSaplingTableBulkUpdate({
    entityHandle: () => 'company',
    selectedItems,
    clearSelection: mocks.clearSelection,
    reload: mocks.reload,
  })
  return { subject, selectedItems }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.bulkUpdate.mockResolvedValue({ updatedCount: 2, handles: ['2', '7'] })
})

describe('useSaplingTableBulkUpdate', () => {
  it('snapshots the selection and submits concurrency targets', async () => {
    const { subject, selectedItems } = createSubject()
    subject.openBulkUpdateDialog()
    selectedItems.value = [{ handle: 99 }]

    await subject.applyBulkUpdate({ isActive: false })

    expect(mocks.bulkUpdate).toHaveBeenCalledWith('company', {
      targets: [
        { handle: 2, expectedUpdatedAt: '2026-07-17T08:00:00.000Z' },
        { handle: 7, expectedUpdatedAt: '2026-07-17T09:00:00.000Z' },
      ],
      changes: { isActive: false },
    })
    expect(subject.bulkUpdateDialog.value).toEqual({
      visible: false,
      isSaving: false,
      items: [],
    })
    expect(mocks.clearSelection).toHaveBeenCalledOnce()
    expect(mocks.reload).toHaveBeenCalledOnce()
  })

  it('keeps the dialog and selection open after an atomic failure', async () => {
    mocks.bulkUpdate.mockRejectedValueOnce(new Error('conflict'))
    const { subject } = createSubject()
    subject.openBulkUpdateDialog()

    await subject.applyBulkUpdate({ name: 'Acme' })

    expect(subject.bulkUpdateDialog.value.visible).toBe(true)
    expect(subject.bulkUpdateDialog.value.isSaving).toBe(false)
    expect(mocks.clearSelection).not.toHaveBeenCalled()
    expect(mocks.reload).not.toHaveBeenCalled()
  })
})
