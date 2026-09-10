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
  it('shows proposal fields in the pending card without opening diagnostics', () => {
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
        ],
        activeToolActionHandles: {},
      },
    })
    const preview = wrapper.find('.sapling-ai-chat__tool-action-preview')
    expect(preview.text()).toContain('Example GmbH')
    expect(preview.text()).toContain('Berlin')
    expect(wrapper.find('.sapling-ai-chat__tool-action-details').exists()).toBe(false)
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
