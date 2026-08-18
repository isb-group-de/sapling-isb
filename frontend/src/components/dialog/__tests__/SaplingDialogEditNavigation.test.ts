import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
            kind: '1:m',
          },
        ] as never,
        relationEntities: {
          notes: { handle: 'note', icon: 'mdi-note-outline' },
        } as never,
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
    expect(buttons[1].text()).toContain('mdi-note-outline')
    expect(buttons[1].text()).toContain('1:m')
    expect(buttons[1].classes()).toContain('sapling-record-dialog-nav-item--one-to-many')
    expect(buttons[1].attributes('aria-label')).toContain('(1:m)')

    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:activeTab')).toEqual([[1]])
    expect(wrapper.findAll('button')[1].attributes('aria-current')).toBe('page')
  })

  it('marks many-to-many relations and falls back to the link icon without entity metadata', () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'ticket',
        entityLabel: 'Tickets',
        mode: 'edit' as const,
        relationTemplates: [
          { name: 'watchers', type: 'collection', kind: 'm:n' },
          { name: 'teams', type: 'collection', kind: 'n:m' },
        ] as never,
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

    const relationButtons = wrapper.findAll('button').slice(1)
    expect(relationButtons).toHaveLength(2)
    relationButtons.forEach((button) => {
      expect(button.text()).toContain('mdi-link-variant')
      expect(button.text()).toContain('m:n')
      expect(button.classes()).toContain('sapling-record-dialog-nav-item--many-to-many')
    })
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

  it('uses arrow, Home, and End keys as a roving tablist', async () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'ticket',
        entityLabel: 'Tickets',
        mode: 'edit' as const,
        relationTemplates: [
          { name: 'notes', type: 'collection', kind: '1:m' },
          { name: 'watchers', type: 'collection', kind: 'm:n' },
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

    expect(wrapper.get('nav').attributes('role')).toBe('tablist')
    expect(wrapper.findAll('[role="tab"]')[0].attributes('aria-controls')).toBe(
      'sapling-record-dialog-ticket-panel-0',
    )
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.attributes('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ])

    await wrapper.findAll('[role="tab"]')[0].trigger('keydown', { key: 'End' })
    await nextTick()

    expect(wrapper.findAll('[role="tab"]')[2].attributes('aria-selected')).toBe('true')
    expect(wrapper.findAll('[role="tab"]')[2].attributes('tabindex')).toBe('0')

    await wrapper.findAll('[role="tab"]')[2].trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[0].attributes('aria-selected')).toBe('true')

    await wrapper.findAll('[role="tab"]')[0].trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    await wrapper.findAll('[role="tab"]')[1].trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(wrapper.findAll('[role="tab"]')[0].attributes('aria-selected')).toBe('true')
  })
})
