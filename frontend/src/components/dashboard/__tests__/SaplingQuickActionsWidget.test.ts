import { flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingQuickActionsWidget from '../SaplingQuickActionsWidget.vue'
import SaplingWidgetCreateDialog from '../SaplingWidgetCreateDialog.vue'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  loadGeneric: vi.fn(),
  permissions: {
    accumulatedPermission: [{ entityHandle: 'ticket', allowRead: true, allowInsert: true }],
    fetchCurrentPermission: vi.fn(),
  },
}))
vi.mock('@/stores/genericStore', () => ({
  useGenericStore: () => ({ getState: mocks.getState, loadGeneric: mocks.loadGeneric }),
}))
vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => mocks.permissions,
}))

function mountWidget(editing = false) {
  return shallowMount(SaplingQuickActionsWidget, {
    props: {
      editing,
      widget: {
        id: 'actions',
        kind: 'ACTIONS',
        title: 'Actions',
        columns: 1,
        rows: 1,
        config: { actions: [{ id: 'ticket', entity: 'ticket', label: 'New ticket' }] },
      },
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        'v-btn': {
          props: ['disabled'],
          template: '<button :disabled="disabled"><slot /></button>',
        },
      },
    },
  })
}
describe('quick action permissions and dialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissions.accumulatedPermission = reactive([
      { entityHandle: 'ticket', allowRead: true, allowInsert: true },
    ])
    mocks.getState.mockReturnValue({ entity: { handle: 'ticket', canInsert: true } })
    mocks.loadGeneric.mockResolvedValue(undefined)
  })
  it('loads metadata and opens the native create dialog only after clicking', async () => {
    const wrapper = mountWidget()
    expect(wrapper.findComponent(SaplingWidgetCreateDialog).exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.loadGeneric).toHaveBeenCalledWith('ticket', 'global')
    expect(wrapper.getComponent(SaplingWidgetCreateDialog).props('entityHandle')).toBe('ticket')
    await wrapper.getComponent(SaplingWidgetCreateDialog).vm.$emit('close')
    expect(wrapper.findComponent(SaplingWidgetCreateDialog).exists()).toBe(false)
    wrapper.unmount()
  })
  it.each(['permission', 'capability', 'editing'])(
    'disables actions blocked by %s',
    async (reason) => {
      if (reason === 'permission') mocks.permissions.accumulatedPermission[0]!.allowInsert = false
      if (reason === 'capability') mocks.getState.mockReturnValue({ entity: { canInsert: false } })
      const wrapper = mountWidget(reason === 'editing')
      expect(wrapper.get('button').attributes('disabled')).toBeDefined()
      await wrapper.get('button').trigger('click')
      expect(mocks.loadGeneric).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )
  it('rechecks capabilities after metadata loads', async () => {
    mocks.getState.mockReturnValue({ entity: null })
    mocks.loadGeneric.mockImplementation(async () => {
      mocks.getState.mockReturnValue({ entity: { canInsert: false } })
    })
    const wrapper = mountWidget()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(SaplingWidgetCreateDialog).exists()).toBe(false)
    wrapper.unmount()
  })
})
