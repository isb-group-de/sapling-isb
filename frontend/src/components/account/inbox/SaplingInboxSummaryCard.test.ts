import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingInboxSummaryCard from './SaplingInboxSummaryCard.vue'

describe('inbox category button', () => {
  it('exposes a native toggle button and emits repeated selections', async () => {
    const wrapper = mount(SaplingInboxSummaryCard, {
      props: {
        card: {
          key: 'ticket',
          labelKey: 'navigation.ticket',
          count: 2,
          icon: 'mdi-ticket',
          tone: 'info',
        },
        active: false,
      },
      global: { mocks: { $t: (key: string) => key }, stubs: { VIcon: true } },
    })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('aria-pressed')).toBe('false')
    await wrapper.trigger('click')
    await wrapper.setProps({ active: true })
    expect(wrapper.attributes('aria-pressed')).toBe('true')
    expect(wrapper.classes()).toContain('sapling-inbox-summary-card--active')
    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['ticket'], ['ticket']])
  })
})
