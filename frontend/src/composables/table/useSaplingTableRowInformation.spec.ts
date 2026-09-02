import { flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InformationItem } from '@/entity/entity'
import { useSaplingTableRowInformation } from './useSaplingTableRowInformation'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  loadGeneric: vi.fn(),
  currentPerson: { handle: 7 },
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: mocks.find,
    update: mocks.update,
    create: mocks.create,
    delete: mocks.remove,
  },
}))

vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({
    person: mocks.currentPerson,
    fetchCurrentPerson: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    loadGeneric: mocks.loadGeneric,
    getState: () => ({
      entityPermission: { allowInsert: true, allowUpdate: true, allowDelete: true },
    }),
  }),
}))

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))

describe('useSaplingTableRowInformation draft recovery', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/table/ticket')
    mocks.find.mockReset().mockResolvedValue({
      data: [
        {
          handle: 11,
          content: 'Persisted information',
          updatedAt: new Date('2026-09-02T08:00:00.000Z'),
        } satisfies Partial<InformationItem>,
      ],
    })
    mocks.update.mockReset()
    mocks.create.mockReset()
    mocks.remove.mockReset()
    mocks.loadGeneric.mockReset().mockResolvedValue(undefined)
  })

  it('restores only the matching record draft and clears it on discard', async () => {
    const props = reactive({
      show: true,
      item: { handle: 42, updatedAt: '2026-09-02T07:00:00.000Z' },
      entityHandle: 'ticket',
      closeAfterSave: false,
    })
    const first = useSaplingTableRowInformation(props, vi.fn())
    await flushPromises()

    first.content.value = 'Recovered internal information'
    await nextTick()

    const reopened = useSaplingTableRowInformation(props, vi.fn())
    await flushPromises()

    expect(reopened.content.value).toBe('Recovered internal information')
    expect(reopened.isDirty.value).toBe(true)

    props.item = { handle: 43, updatedAt: '2026-09-02T07:00:00.000Z' }
    await flushPromises()
    expect(reopened.content.value).toBe('Persisted information')

    props.item = { handle: 42, updatedAt: '2026-09-02T07:00:00.000Z' }
    await flushPromises()
    expect(reopened.content.value).toBe('Recovered internal information')

    reopened.discardChanges()
    await nextTick()
    expect(reopened.content.value).toBe('Persisted information')

    const afterDiscard = useSaplingTableRowInformation(props, vi.fn())
    await flushPromises()
    expect(afterDiscard.content.value).toBe('Persisted information')
  })
})
