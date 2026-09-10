import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingAiChatToolActions from './SaplingAiChatToolActions.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    te: () => true,
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'event.assigneePerson') return 'Zuständige Person'
      if (key === 'aiChat.toolActionInvalidFields') {
        return `Bitte prüfen Sie: ${String(params?.fields ?? '')}.`
      }
      return key
    },
  }),
}))

vi.mock('./useSaplingAiChatNavigation', () => ({
  useSaplingAiChatNavigation: () => ({
    getNavigationEntityLabel: () => 'Termin',
    getNavigationLinkLabel: () => '',
    openNavigationLink: vi.fn(),
  }),
}))

describe('SaplingAiChatToolActions', () => {
  it('opens the selected action preview only through its info button without executing it', async () => {
    const wrapper = shallowMount(SaplingAiChatToolActions, {
      props: {
        actions: [
          {
            handle: 9,
            session: 1,
            person: 17,
            serverName: 'sapling',
            toolName: 'generic_create',
            status: 'pending',
            arguments: { entityHandle: 'company', data: { name: 'Example GmbH', city: 'Berlin' } },
          },
          {
            handle: 10,
            session: 1,
            person: 17,
            serverName: 'sapling',
            toolName: 'generic_create',
            status: 'pending',
            arguments: { entityHandle: 'company', data: { name: 'Second GmbH', city: 'Hamburg' } },
          },
        ],
        activeToolActionHandles: {},
      },
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          SaplingActionBar: { template: '<div><slot name="leading" /></div>' },
          SaplingDialog: {
            props: ['modelValue'],
            template: '<div v-if="modelValue" role="dialog"><slot /></div>',
          },
          VBtn: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })
    expect(wrapper.find('table').exists()).toBe(false)
    const cards = wrapper.findAll('.sapling-ai-chat__tool-action')
    expect(cards[0]!.text()).toContain('Example GmbH')
    expect(cards[0]!.text()).not.toContain('Berlin')
    await cards[1]!.get('[aria-label="aiChat.toolActionDetails"]').trigger('click')
    expect(wrapper.get('table').text()).toContain('Hamburg')
    expect(wrapper.get('table').text()).not.toContain('Berlin')
    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.emitted('reject')).toBeUndefined()
    await wrapper.get('[role="dialog"] button').trigger('click')
    expect(wrapper.find('table').exists()).toBe(false)
    await cards[0]!.get('[aria-label="aiChat.toolActionDetails"]').trigger('click')
    const preview = wrapper.get('table')
    expect(preview.text()).toContain('Example GmbH')
    expect(preview.text()).toContain('Berlin')
    await cards[0]!.get('[aria-label="aiChat.confirmToolAction"]').trigger('click')
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toMatchObject({ handle: 9 })
    await wrapper.setProps({ activeToolActionHandles: { 9: true } })
    expect(
      cards[0]!.get('[aria-label="aiChat.confirmToolAction"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      cards[0]!.get('[aria-label="aiChat.rejectToolAction"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('shows the affected field for a failed schema-repair action', () => {
    const wrapper = shallowMount(SaplingAiChatToolActions, {
      props: {
        actions: [
          {
            handle: 7,
            session: 1,
            person: 17,
            serverName: 'sapling',
            toolName: 'generic_create',
            status: 'failed',
            arguments: { entityHandle: 'event' },
            errorPayload: {
              error: 'ai.toolActionSchemaRetryRequired',
              status: 'needs_schema_retry',
              invalidReferences: [
                {
                  fieldName: 'assigneePerson',
                  parentFieldName: 'assigneeCompany',
                  reason: 'referenceDependencyMismatch',
                },
              ],
            },
          },
        ],
        activeToolActionHandles: {},
      },
      global: {
        stubs: {
          VAlert: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Bitte prüfen Sie: Zuständige Person.')
  })
})
