import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingHeaderQuicklinks from '../SaplingHeaderQuicklinks.vue'

const harness = vi.hoisted(() => ({
  push: vi.fn(),
  fetchCurrentPermission: vi.fn(),
  permissions: [] as Array<{
    entityHandle: string
    allowRead: boolean
    allowShow: boolean
  }>,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: harness.push }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: ref('de'),
    t: (key: string) =>
      ({
        'global.quickLinks': 'Quicklinks',
        'navigation.effortEstimate': 'Aufwandsschätzungen',
        'navigation.calendar': 'Kalender',
        'navigation.ticket': 'Tickets',
        'navigation.salesOpportunity': 'Verkaufschancen',
        'navigation.internalCase': 'Vorgänge',
      })[key] ?? '',
  }),
}))

vi.mock('@/stores/currentPermissionStore', () => ({
  useCurrentPermissionStore: () => ({
    accumulatedPermission: harness.permissions,
    fetchCurrentPermission: harness.fetchCurrentPermission,
  }),
}))

const allQuicklinkPermissions = [
  'effortEstimate',
  'event',
  'ticket',
  'salesOpportunity',
  'internalCase',
].map((entityHandle) => ({ entityHandle, allowRead: true, allowShow: true }))

function mountQuicklinks() {
  return mount(SaplingHeaderQuicklinks, {
    global: {
      stubs: {
        VMenu: {
          template: '<div><slot name="activator" :props="{}" /><slot /></div>',
        },
        VBtn: {
          template: '<button v-bind="$attrs"><slot /></button>',
        },
        VIcon: {
          props: ['icon'],
          template: '<span :data-icon="icon">{{ icon }}</span>',
        },
        SaplingSurface: { template: '<div class="glass-panel"><slot /></div>' },
        VListItem: {
          props: ['prependIcon', 'title'],
          emits: ['click'],
          template:
            '<button v-bind="$attrs" @click="$emit(\'click\')"><span>{{ prependIcon }}</span>{{ title }}</button>',
        },
      },
    },
  })
}

describe('SaplingHeaderQuicklinks', () => {
  beforeEach(() => {
    harness.push.mockReset()
    harness.fetchCurrentPermission.mockReset()
    harness.permissions = allQuicklinkPermissions.map((permission) => ({ ...permission }))
  })

  it('renders the requested destinations alphabetically', () => {
    const wrapper = mountQuicklinks()

    expect(wrapper.find('.glass-panel').exists()).toBe(true)
    expect(wrapper.get('[data-tutorial="header-quicklinks"]').classes()).toContain(
      'sapling-button--action',
    )
    expect(wrapper.find('[data-icon="mdi-lightning-bolt-outline"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-quicklink]').map((item) => item.text())).toEqual([
      'mdi-clipboard-text-clock-outlineAufwandsschätzungen',
      'mdi-calendar-starKalender',
      'mdi-ticketTickets',
      'mdi-cash-multipleVerkaufschancen',
      'mdi-clipboard-text-outlineVorgänge',
    ])
  })

  it.each([
    ['effortEstimate', '/partner/effortEstimate'],
    ['calendar', '/event'],
    ['ticket', '/partner/ticket'],
    ['salesOpportunity', '/partner/salesOpportunity'],
    ['internalCase', '/partner/internalCase'],
  ])('navigates %s to its requested workspace', async (key, path) => {
    const wrapper = mountQuicklinks()

    await wrapper.get(`[data-quicklink="${key}"]`).trigger('click')

    expect(harness.push).toHaveBeenCalledWith(path)
  })

  it('renders only destinations with workspace access', () => {
    harness.permissions = [
      { entityHandle: 'ticket', allowRead: true, allowShow: true },
      { entityHandle: 'event', allowRead: true, allowShow: false },
    ]

    const wrapper = mountQuicklinks()

    expect(
      wrapper.findAll('[data-quicklink]').map((item) => item.attributes('data-quicklink')),
    ).toEqual(['ticket'])
  })

  it('hides the quicklink activator when no destination is accessible', () => {
    harness.permissions = []

    const wrapper = mountQuicklinks()

    expect(wrapper.find('[data-tutorial="header-quicklinks"]').exists()).toBe(false)
  })
})
