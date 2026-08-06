import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { EntityTemplate } from '@/entity/structure'
import SaplingTableGenericReference from '../SaplingTableGenericReference.vue'

const mocks = vi.hoisted(() => {
  const targetTemplates = [
    {
      key: 'ticketNumber',
      name: 'ticketNumber',
      type: 'string',
      options: ['isValue'],
    },
  ]

  return {
    findByHandles: vi.fn().mockResolvedValue([{ handle: 5, ticketNumber: 'T-0005' }]),
    getState: vi.fn(() => ({
      entity: { handle: 'ticket' },
      entityTemplates: targetTemplates,
    })),
    loadGeneric: vi.fn().mockResolvedValue(undefined),
    routerPush: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({
    getState: mocks.getState,
    loadGeneric: mocks.loadGeneric,
  }),
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    findByHandles: mocks.findByHandles,
  },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: () => 'Tickets',
      te: () => true,
    }),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

const genericReferenceTemplate = {
  key: 'reference',
  name: 'reference',
  type: 'string',
  genericReference: {
    entityField: 'entity',
    handleField: 'reference',
  },
} satisfies EntityTemplate

describe('SaplingTableGenericReference', () => {
  it('prefetches and displays a generic reference label without requiring a click', async () => {
    vi.useFakeTimers()

    const wrapper = mount(SaplingTableGenericReference, {
      props: {
        item: { handle: 1, entity: 'ticket', reference: 5 },
        col: genericReferenceTemplate,
      },
      global: {
        stubs: {
          SaplingDialogEdit: true,
          VBtn: { template: '<button><slot /></button>' },
          VIcon: { template: '<i><slot /></i>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Tickets #5')

    await vi.runAllTimersAsync()
    await flushPromises()
    await nextTick()

    expect(mocks.findByHandles).toHaveBeenCalledWith('ticket', [5], expect.any(Object))
    expect(wrapper.text()).toContain('T-0005')
    expect(wrapper.text()).not.toContain('Tickets #5')

    wrapper.unmount()
    vi.useRealTimers()
  })
})
