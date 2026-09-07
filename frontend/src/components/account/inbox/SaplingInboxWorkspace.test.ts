import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingInboxWorkspace from './SaplingInboxWorkspace.vue'
import type { InboxEntry, InboxSection } from '@/composables/account/saplingInbox.utils'

function mountWorkspace(dismiss = vi.fn().mockResolvedValue(undefined)) {
  const entries: InboxEntry[] = ['First', 'Second'].map((title, index) => ({
    id: title,
    title,
    kind: 'notification',
    kindLabelKey: 'navigation.inboxNotification',
    sourceEntity: 'event',
    referenceHandle: String(index + 10),
    description: `${title} details`,
    dateText: '',
    dateValue: null,
    icon: 'mdi-bell',
    supportLabels: [],
    route: '/event',
    dismissible: true,
  }))
  const wrapper = mount(SaplingInboxWorkspace, {
    props: {
      sections: [
        { key: 'overdue', titleKey: 'inbox.overdue', tone: 'warning', items: [] },
      ] as unknown as InboxSection[],
      notifications: entries,
      cards: [],
      overdueEventCount: 2,
      dismiss,
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        VBtn: { template: '<button><slot /></button>' },
        VIcon: true,
        VTextField: true,
        VPagination: true,
        VChip: { template: '<span><slot /></span>' },
        VAlert: { props: ['text'], template: '<div role="alert">{{ text }}</div>' },
      },
    },
  })
  async function click(text: string) {
    const button = wrapper.findAll('button').find((item) => item.text().includes(text))
    if (!button) throw new Error(`Missing button: ${text}`)
    await button.trigger('click')
  }
  return { wrapper, click, entries, dismiss }
}

describe('inbox workspace actions', () => {
  it('offers history only in the selected notification details and preserves selection on click', async () => {
    const { wrapper, click, entries, dismiss } = mountWorkspace()
    await click('navigation.inboxNotification')
    await wrapper.findAll('.sapling-inbox-workspace__row')[1]!.trigger('click')
    expect(wrapper.emitted('change-log')).toBeUndefined()
    expect(wrapper.get('.sapling-inbox-workspace__list-pane').text()).not.toContain(
      'global.changeLog',
    )
    await click('global.changeLog')
    expect(wrapper.emitted('change-log')).toEqual([[entries[1]]])
    expect(wrapper.get('.sapling-inbox-workspace__row--selected').text()).toContain('Second')
    expect(wrapper.emitted('open')).toBeUndefined()
    expect(dismiss).not.toHaveBeenCalled()
  })

  it.each([
    { sourceEntity: undefined },
    { referenceHandle: undefined },
    { kind: 'event' as const },
  ])('hides history when the entry is not a referenced notification (%j)', async (overrides) => {
    const { wrapper, click, entries } = mountWorkspace()
    await wrapper.setProps({ notifications: [{ ...entries[0]!, ...overrides }] })
    await click('navigation.inboxNotification')
    expect(wrapper.text()).not.toContain('global.changeLog')
  })

  it('renders the original notification Markdown with the shared renderer', async () => {
    const { wrapper, click, entries } = mountWorkspace()
    await wrapper.setProps({
      notifications: [
        {
          ...entries[0]!,
          description: 'Plain preview',
          descriptionMarkdown:
            '## Details\n\n**Important**\n\n- First item\n- Second item\n\n[Record](https://example.com)\n\n<script>alert(1)</script>',
        },
      ],
    })
    await click('navigation.inboxNotification')
    const description = wrapper.get('.sapling-inbox-workspace__description')
    expect(description.get('h2').text()).toBe('Details')
    expect(description.get('strong').text()).toBe('Important')
    expect(description.findAll('li')).toHaveLength(2)
    expect(description.get('a').attributes('href')).toBe('https://example.com')
    expect(description.find('script').exists()).toBe(false)
    expect(wrapper.get('.sapling-inbox-workspace__excerpt').text()).toBe('Plain preview')
  })

  it('previews a selected entry without opening or acknowledging it', async () => {
    const { wrapper, click, entries, dismiss } = mountWorkspace()
    await click('navigation.inboxNotification')
    await wrapper.findAll('.sapling-inbox-workspace__row')[1]!.trigger('click')
    expect(wrapper.get('.sapling-inbox-workspace__description').text()).toBe('Second details')
    expect(wrapper.emitted('open')).toBeUndefined()
    expect(dismiss).not.toHaveBeenCalled()
    await click('inbox.openEntry')
    expect(wrapper.emitted('open')).toEqual([[entries[1]]])
  })

  it('shows acknowledgement failures and allows retry without removing the entry', async () => {
    const dismiss = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    const { wrapper, click } = mountWorkspace(dismiss)
    await click('navigation.inboxNotification')
    await click('inbox.markRead')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('inbox.markReadFailed')
    expect(wrapper.findAll('.sapling-inbox-workspace__row')).toHaveLength(2)
    await click('inbox.markRead')
    await flushPromises()
    expect(dismiss).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('offers overdue completion only in the explicit overdue task view', async () => {
    const { wrapper, click } = mountWorkspace()
    expect(wrapper.text()).not.toContain('inbox.completeEventsAction')
    await click('inbox.overdue')
    await click('inbox.completeEventsAction')
    expect(wrapper.emitted('complete-events')).toEqual([[]])
    await click('navigation.inboxNotification')
    expect(wrapper.text()).not.toContain('inbox.completeEventsAction')
  })
})
