import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import SaplingDialogEditNavigation from '../SaplingDialogEditNavigation.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

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
    expect(buttons[1].text()).not.toContain('1:m')
    expect(buttons[1].attributes('aria-label')).toBe('ticket.notes')
    expect(buttons[1].attributes('title')).toBeUndefined()

    await buttons[1].trigger('click')

    expect(wrapper.emitted('update:activeTab')).toEqual([[1]])
    expect(wrapper.findAll('button')[1].attributes('aria-current')).toBe('page')
  })

  it('hides technical cardinalities and falls back to the link icon without entity metadata', () => {
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
      expect(button.text()).not.toMatch(/[mn]:[mn]/)
      expect(button.attributes('title')).toBeUndefined()
    })
  })

  it('allows selecting relation tabs while creating a record', async () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'ticket',
        entityLabel: 'Tickets',
        mode: 'create' as const,
        relationTemplates: [{ name: 'notes', type: 'collection', kind: '1:m' }] as never,
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
    expect(wrapper.text()).not.toContain('global.referencesAvailableAfterSave')
    expect(buttons[1].text()).toContain('mdi-note-outline')
    expect(buttons[1].text()).not.toContain('1:m')
    expect(buttons[1].text()).not.toContain('mdi-lock-outline')
    expect(buttons[1].classes()).not.toContain('sapling-record-dialog-nav-item--locked')
    expect(buttons[1].attributes('aria-disabled')).toBeUndefined()
    expect(buttons[1].attributes('tabindex')).toBe('-1')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:activeTab')).toEqual([[1]])
    expect(wrapper.findAll('button')[1].attributes('aria-selected')).toBe('true')
  })

  it('marks record and relation tabs independently when they contain changes', async () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'company',
        entityLabel: 'Companies',
        mode: 'create' as const,
        dirtyFieldCount: 0,
        dirtyRelationNames: [],
        relationTemplates: [
          { name: 'people', type: 'collection', kind: '1:m' },
          { name: 'contracts', type: 'collection', kind: '1:m' },
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

    await wrapper.setProps({ dirtyFieldCount: 2, dirtyRelationNames: ['people'] })

    const [recordButton, ...relationButtons] = wrapper.findAll('button')
    expect(recordButton.classes()).toContain('sapling-record-dialog-nav-item--dirty')
    expect(recordButton.find('.sapling-record-dialog-nav-item__dirty-indicator').exists()).toBe(
      true,
    )
    expect(recordButton.attributes('aria-label')).toContain('global.dirtyFieldCount')
    expect(relationButtons[0].classes()).toContain('sapling-record-dialog-nav-item--dirty')
    expect(
      relationButtons[0].find('.sapling-record-dialog-nav-item__dirty-indicator').exists(),
    ).toBe(true)
    expect(relationButtons[0].attributes('aria-label')).toContain('global.dirtyFieldCount')
    expect(relationButtons[1].classes()).not.toContain('sapling-record-dialog-nav-item--dirty')
  })

  it('locks relation tabs in a deferred child create dialog', async () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'person',
        entityLabel: 'People',
        mode: 'create' as const,
        relationsLocked: true,
        relationTemplates: [{ name: 'tickets', type: 'collection', kind: '1:m' }] as never,
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

    const relationButton = wrapper.findAll('button')[1]
    expect(wrapper.text()).toContain('global.referencesAvailableAfterSave')
    expect(relationButton.classes()).toContain('sapling-record-dialog-nav-item--locked')
    expect(relationButton.attributes('aria-disabled')).toBe('true')
    expect(relationButton.attributes('aria-describedby')).toContain('relations-locked-hint')

    await relationButton.trigger('click')

    expect(wrapper.emitted('update:activeTab')).toBeUndefined()
  })

  it('keeps a programmatically selected relation active while creating', () => {
    const updateActiveTab = vi.fn()
    mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 1,
        entityHandle: 'ticket',
        entityLabel: 'Tickets',
        mode: 'create' as const,
        relationTemplates: [{ name: 'notes', type: 'collection', kind: '1:m' }] as never,
        'onUpdate:activeTab': updateActiveTab,
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

    expect(updateActiveTab).not.toHaveBeenCalled()
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

  it('renders supplemental record tabs after relations and skips disabled tabs by keyboard', async () => {
    const wrapper = mount(SaplingDialogEditNavigation, {
      props: {
        activeTab: 0,
        entityHandle: 'company',
        entityLabel: 'Companies',
        mode: 'edit' as const,
        relationTemplates: [{ name: 'people', type: 'collection', kind: '1:m' }] as never,
        supplementalTabs: [
          {
            value: 2,
            label: 'Information',
            icon: 'mdi-text-box-edit-outline',
            disabled: true,
            disabledReason: 'Permission denied',
          },
          {
            value: 3,
            label: 'Documents',
            icon: 'mdi-file-document-multiple-outline',
          },
        ],
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

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(4)
    expect(tabs[2].attributes('aria-disabled')).toBe('true')
    expect(tabs[2].attributes('aria-label')).toContain('Permission denied')
    expect(tabs[2].classes()).toContain('sapling-record-dialog-nav-item--supplemental-first')
    expect(tabs[3].classes()).not.toContain('sapling-record-dialog-nav-item--supplemental-first')

    await tabs[0].trigger('keydown', { key: 'End' })
    await nextTick()

    expect(wrapper.findAll('[role="tab"]')[3].attributes('aria-selected')).toBe('true')
    expect(wrapper.emitted('update:activeTab')).toContainEqual([3])
  })
})
