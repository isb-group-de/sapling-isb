import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteRecord: vi.fn(),
  pushMessage: vi.fn(),
  clearSelection: vi.fn(),
  reload: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: { delete: mocks.deleteRecord },
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: mocks.pushMessage }),
}))

import { useSaplingTableDeleteActions } from '../useSaplingTableDeleteActions'

function createSubject(itemCount = 2) {
  const selectedItems = ref(
    Array.from({ length: itemCount }, (_, index) => ({ handle: index + 1 })),
  )
  const selectedRows = ref(selectedItems.value.map((_, index) => index))

  return {
    selectedItems,
    subject: useSaplingTableDeleteActions({
      entityHandle: () => 'ticket',
      selectedItems,
      selectedRows,
      clearSelection: mocks.clearSelection,
      reload: mocks.reload,
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.deleteRecord.mockResolvedValue(undefined)
})

describe('useSaplingTableDeleteActions', () => {
  it('deletes one confirmed record and closes the dialog', async () => {
    const { subject } = createSubject()
    subject.openDeleteDialog({ handle: 42 })

    await subject.confirmDelete()

    expect(mocks.deleteRecord).toHaveBeenCalledWith('ticket', 42)
    expect(subject.deleteDialog.value).toEqual({ visible: false, item: null })
    expect(mocks.reload).toHaveBeenCalledOnce()
  })

  it('snapshots the selection and deletes all captured handles', async () => {
    const { subject, selectedItems } = createSubject(7)
    subject.deleteAllSelected()
    selectedItems.value = [{ handle: 99 }]

    await subject.confirmBulkDelete()

    expect(mocks.deleteRecord).toHaveBeenCalledTimes(7)
    expect(mocks.deleteRecord).toHaveBeenNthCalledWith(1, 'ticket', 1)
    expect(mocks.deleteRecord).toHaveBeenNthCalledWith(7, 'ticket', 7)
    expect(mocks.clearSelection).toHaveBeenCalledOnce()
    expect(subject.bulkDeleteDialog.value).toEqual({ visible: false, items: [] })
  })

  it('keeps the bulk confirmation open when deletion fails', async () => {
    mocks.deleteRecord.mockRejectedValueOnce(new Error('failed'))
    const { subject } = createSubject()
    subject.deleteAllSelected()

    await subject.confirmBulkDelete()

    expect(subject.bulkDeleteDialog.value.visible).toBe(true)
    expect(mocks.clearSelection).not.toHaveBeenCalled()
    expect(mocks.reload).not.toHaveBeenCalled()
  })
})
