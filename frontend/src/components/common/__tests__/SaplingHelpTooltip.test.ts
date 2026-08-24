import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import SaplingHelpTooltip from '../SaplingHelpTooltip.vue'

const VTooltipStub = defineComponent({
  props: {
    text: { type: String, default: '' },
    modelValue: Boolean,
    openOnClick: Boolean,
    openOnFocus: Boolean,
    openOnHover: Boolean,
  },
  template: '<div class="tooltip-stub"><slot name="activator" :props="{ title: text }" /></div>',
})

describe('SaplingHelpTooltip', () => {
  it('provides an accessible question-mark activator for hover, focus, and click', async () => {
    const wrapper = mount(SaplingHelpTooltip, {
      props: {
        text: 'Explains this field.',
        ariaLabel: 'Field help',
      },
      global: {
        stubs: {
          VTooltip: VTooltipStub,
          VIcon: { template: '<span>{{ icon }}</span>', props: ['icon'] },
        },
      },
    })

    const tooltip = wrapper.getComponent(VTooltipStub)
    expect(tooltip.props()).toMatchObject({
      text: 'Explains this field.',
      openOnClick: true,
      openOnFocus: true,
      openOnHover: true,
    })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Field help')
    expect(wrapper.text()).toContain('mdi-help-circle-outline')

    await wrapper.get('button').trigger('click')
    expect(tooltip.props('modelValue')).toBe(true)
  })

  it('supports an action control as the activator', () => {
    const wrapper = mount(SaplingHelpTooltip, {
      props: { text: 'Open search' },
      slots: {
        activator: '<button class="action">Search</button>',
      },
      global: { stubs: { VTooltip: VTooltipStub } },
    })

    expect(wrapper.get('.action').text()).toBe('Search')
    expect(wrapper.find('.sapling-help-tooltip').exists()).toBe(false)
  })
})
