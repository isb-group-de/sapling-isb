import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingHeaderStatusActions from '../SaplingHeaderStatusActions.vue'

function mountActions(inboxCount: number, messageCount = inboxCount) {
  return mount(SaplingHeaderStatusActions, {
    props: {
      inboxCount,
      messageCount,
      inboxBadgeColor: 'error',
      messageBadgeColor: 'info',
      moreLabel: 'Mehr',
      inboxLabel: 'Posteingang',
      messageCenterLabel: 'Meldungszentrale',
      helpLabel: 'Hilfe',
      searchLabel: 'Suchen',
    },
    global: {
      stubs: {
        SaplingHelpTooltip: { template: '<div><slot name="activator" :props="{}" /></div>' },
        VMenu: { template: '<div><slot name="activator" :props="{}" /><slot /></div>' },
        SaplingSurface: { template: '<div><slot /></div>' },
        VListItem: { template: '<div><slot name="prepend" /><slot name="append" /></div>' },
        VBtn: { template: '<button><slot /></button>' },
        VIcon: true,
        VBadge: { props: ['content'], template: '<span data-badge><slot />{{ content }}</span>' },
      },
    },
  })
}

describe('header badge displays', () => {
  it.each([
    [0, '0'],
    [9, '9'],
    [13, '13'],
    [99, '99'],
    [100, '99'],
    [1234, '99'],
  ])('displays %i as %s in both desktop and mobile badges', (count, expected) => {
    const wrapper = mountActions(count)
    expect(wrapper.findAll('[data-badge]').map((badge) => badge.text())).toEqual(
      Array(4).fill(expected),
    )
    expect(wrapper.get('[data-tutorial="header-inbox"]').attributes('aria-label')).toBe(
      `Posteingang: ${expected}`,
    )
    expect(wrapper.get('[data-tutorial="header-message-center"]').attributes('aria-label')).toBe(
      `Meldungszentrale: ${expected}`,
    )
    wrapper.unmount()
  })

  it('updates the two counters independently and preserves their actions', async () => {
    const wrapper = mountActions(123, 13)
    await wrapper.setProps({ inboxCount: 14, messageCount: 250 })
    expect(wrapper.findAll('[data-badge]').map((badge) => badge.text())).toEqual([
      '14',
      '99',
      '14',
      '99',
    ])
    await wrapper.get('[data-tutorial="header-inbox"]').trigger('click')
    await wrapper.get('[data-tutorial="header-message-center"]').trigger('click')
    expect(wrapper.emitted('openInbox')).toEqual([[]])
    expect(wrapper.emitted('openMessageCenter')).toEqual([[]])
    wrapper.unmount()
  })
})
