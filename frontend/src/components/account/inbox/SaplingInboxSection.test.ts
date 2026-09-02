import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingInboxSection from '@/components/account/inbox/SaplingInboxSection.vue'
import type { InboxSection } from '@/composables/account/useSaplingInbox'

function createSection(): InboxSection {
  return {
    key: 'overdue',
    titleKey: 'inbox.overdue',
    subtitleKey: 'inbox.overdueSummary',
    emptyKey: 'inbox.overdueEmpty',
    icon: 'mdi-alert-circle-outline',
    tone: 'warning',
    count: 3,
    items: [
      {
        id: 'event-1',
        kind: 'event',
        kindLabelKey: 'navigation.event',
        title: 'Old event',
        description: '',
        dateText: '01.09.2026',
        dateValue: new Date('2026-09-01T08:00:00.000Z'),
        icon: 'mdi-calendar',
        supportLabels: [],
        route: '/event',
      },
    ],
    empty: false,
  }
}

describe('SaplingInboxSection', () => {
  it('keeps the count in the header and renders the completion action below the list', () => {
    const wrapper = mount(SaplingInboxSection, {
      props: {
        section: createSection(),
        showCompleteEventsAction: true,
      },
      global: {
        mocks: {
          $t: (key: string, params?: { count?: number }) =>
            params?.count == null ? key : `${key}:${params.count}`,
        },
        stubs: {
          VIcon: true,
          VChip: { template: '<span><slot /></span>' },
          VBtn: { template: '<button><slot /></button>' },
          SaplingInboxEntryCard: { template: '<div class="entry-card" />' },
        },
      },
    })

    const header = wrapper.get('.sapling-section-header')
    expect(header.text()).toContain('3')
    expect(header.text()).not.toContain('inbox.completeEventsAction')

    const list = wrapper.get('.sapling-inbox-entry-list')
    const footer = wrapper.get('.sapling-inbox-section__footer-action')
    expect(
      list.element.compareDocumentPosition(footer.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(footer.text()).toContain('inbox.completeEventsAction')
  })
})
