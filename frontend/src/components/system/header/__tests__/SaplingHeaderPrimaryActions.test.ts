import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SaplingHeaderPrimaryActions from '../SaplingHeaderPrimaryActions.vue'

describe('SaplingHeaderPrimaryActions', () => {
  it('renders a centered icon-based home action and exposes quicklinks', async () => {
    const wrapper = mount(SaplingHeaderPrimaryActions, {
      props: {
        homeLabel: 'Zurück zur Startseite',
      },
      global: {
        stubs: {
          VTooltip: {
            template: '<div><slot name="activator" :props="{}" /></div>',
          },
          VBtn: {
            props: ['to'],
            template: '<a v-bind="$attrs" :href="to"><slot /></a>',
          },
          VIcon: {
            props: ['icon'],
            template: '<span :data-icon="icon">{{ icon }}</span>',
          },
          SaplingHeaderQuicklinks: {
            template: '<button data-tutorial="header-quicklinks">Quicklinks</button>',
          },
        },
      },
    })

    const home = wrapper.get('[data-tutorial="header-home"]')
    expect(home.classes()).toContain('sapling-button--action')
    expect(home.attributes('aria-label')).toBe('Zurück zur Startseite')
    expect(home.attributes('href')).toBe('/')
    expect(home.find('[data-icon="mdi-home-outline"]').exists()).toBe(true)
    expect(home.text()).toContain('Sapling')
    expect(wrapper.find('[data-tutorial="header-quicklinks"]').exists()).toBe(true)
  })
})
