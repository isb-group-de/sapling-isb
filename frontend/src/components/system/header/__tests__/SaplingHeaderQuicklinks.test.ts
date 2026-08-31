import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingHeaderQuicklinks from '../SaplingHeaderQuicklinks.vue'

const harness = vi.hoisted(() => ({
  fetchCurrentPermission: vi.fn(),
  permissions: [] as Array<{
    entityHandle: string
    allowRead: boolean
    allowShow: boolean
  }>,
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
          props: ['prependIcon', 'title', 'to'],
          template: '<a v-bind="$attrs" :href="to"><span>{{ prependIcon }}</span>{{ title }}</a>',
        },
      },
    },
  })
}

describe('SaplingHeaderQuicklinks', () => {
  beforeEach(() => {
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
  ])('renders %s as a native route link', (key, path) => {
    const wrapper = mountQuicklinks()

    expect(wrapper.get(`[data-quicklink="${key}"]`).attributes('href')).toBe(path)
  })

  it('renders only destinations with both read and navigation access', () => {
    harness.permissions = [
      { entityHandle: 'ticket', allowRead: true, allowShow: true },
      { entityHandle: 'event', allowRead: true, allowShow: false },
      { entityHandle: 'salesOpportunity', allowRead: false, allowShow: true },
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
