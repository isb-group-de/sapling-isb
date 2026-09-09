import { computed, effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ApiGenericService from '@/services/api.generic.service'
import { useSaplingDialogTabCounts } from '../useSaplingDialogTabCounts'

vi.mock('@/services/api.generic.service', () => ({
  default: {
    find: vi.fn(),
  },
}))

const apiFindMock = vi.mocked(ApiGenericService.find)

afterEach(() => {
  apiFindMock.mockReset()
})

describe('useSaplingDialogTabCounts', () => {
  it('waits until the dialog is usable and then loads all visible counts in parallel', async () => {
    const isDialogLoading = ref(true)
    const relationTableLoaded = ref<Record<string, boolean>>({ participants: false })
    const relationTableTotal = ref<Record<string, number>>({ participants: 0 })
    apiFindMock.mockImplementation(async (entityHandle) => ({
      data: [],
      meta: {
        page: 1,
        limit: 1,
        total: entityHandle === 'person' ? 1 : entityHandle === 'document' ? 2 : 0,
        totalPages: entityHandle === 'document' ? 2 : 1,
        executionTime: 0,
      },
    }))

    const scope = effectScope()
    const counts = scope.run(() =>
      useSaplingDialogTabCounts({
        entityHandle: computed(() => 'event'),
        hasPersistedItem: computed(() => true),
        isDialogLoading,
        itemHandle: computed(() => 42),
        relationTemplates: computed(
          () =>
            [
              {
                key: 'participants',
                name: 'participants',
                type: 'Collection<PersonItem>',
                kind: 'm:n',
                referenceName: 'person',
                mappedBy: 'events',
              },
            ] as never,
        ),
        relationTableLoaded,
        relationTableTotal,
        supplementalKinds: computed(() => ['information', 'document', 'email', 'phoneCall']),
      }),
    )!

    await nextTick()
    expect(apiFindMock).not.toHaveBeenCalled()
    expect(counts.relationCounts.value.participants).toBeUndefined()

    isDialogLoading.value = false
    await vi.waitFor(() => expect(apiFindMock).toHaveBeenCalledTimes(5))

    expect(apiFindMock).toHaveBeenCalledWith(
      'person',
      expect.objectContaining({
        filter: { events: 42 },
        page: 1,
        limit: 1,
        fields: ['handle'],
        suppressErrorMessage: true,
      }),
    )
    expect(apiFindMock).toHaveBeenCalledWith(
      'emailDelivery',
      expect.objectContaining({
        filter: { entity: 'event', referenceHandle: '42' },
      }),
    )
    expect(counts.relationCounts.value.participants).toBe(1)
    expect(counts.supplementalCounts.value).toEqual({
      information: 0,
      document: 2,
      email: 0,
      phoneCall: 0,
    })

    relationTableTotal.value.participants = 3
    relationTableLoaded.value.participants = true
    await nextTick()
    expect(counts.relationCounts.value.participants).toBe(3)
    scope.stop()
  })

  it('shows zero without API work for tabs on an unsaved record', async () => {
    const scope = effectScope()
    const counts = scope.run(() =>
      useSaplingDialogTabCounts({
        entityHandle: computed(() => 'event'),
        hasPersistedItem: computed(() => false),
        isDialogLoading: ref(false),
        itemHandle: computed(() => null),
        relationTemplates: computed(() => []),
        relationTableLoaded: ref({}),
        relationTableTotal: ref({}),
        supplementalKinds: computed(() => ['information', 'document']),
      }),
    )!

    await nextTick()
    expect(apiFindMock).not.toHaveBeenCalled()
    expect(counts.supplementalCounts.value).toEqual({ information: 0, document: 0 })
    scope.stop()
  })

  it('keeps failed optional counts unavailable instead of reporting a false zero', async () => {
    apiFindMock.mockRejectedValue(new Error('permission changed'))
    const scope = effectScope()
    const counts = scope.run(() =>
      useSaplingDialogTabCounts({
        entityHandle: computed(() => 'ticket'),
        hasPersistedItem: computed(() => true),
        isDialogLoading: ref(false),
        itemHandle: computed(() => '17'),
        relationTemplates: computed(() => []),
        relationTableLoaded: ref({}),
        relationTableTotal: ref({}),
        supplementalKinds: computed(() => ['information']),
      }),
    )!

    await vi.waitFor(() => expect(apiFindMock).toHaveBeenCalledOnce())
    expect(counts.supplementalCounts.value.information).toBeUndefined()
    scope.stop()
  })
})
