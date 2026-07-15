import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SaplingDialogEditNavigation from '../SaplingDialogEditNavigation.vue'

describe('SaplingDialogEditNavigation', () => {
  it('selects record and relation tabs through the active-tab model', async () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'ticket',
        entityLabel: 'Tickets',
        mode: 'edit' as const,
        relationTemplates: [
          {
            name: 'notes',
            type: 'collection',
          },
        ] as never,
        'onUpdate:activeTab': (value: number) => wrapper.setProps({ activeTab: value }),
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          VIcon: { template: '<span><slot /></span>' },
        },
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('aria-current')).toBe('page')
    expect(buttons[1].text()).toContain('ticket.notes')

    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:activeTab')).toEqual([[1]])
    expect(wrapper.findAll('button')[1].attributes('aria-current')).toBe('page')
  })

  it('hides relation tabs while creating a record', () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'ticket',
        entityLabel: 'Tickets',
        mode: 'create' as const,
        relationTemplates: [{ name: 'notes', type: 'collection' }] as never,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          VIcon: { template: '<span><slot /></span>' },
        },
      },
    })

    expect(wrapper.findAll('button')).toHaveLength(1)
  })
})
