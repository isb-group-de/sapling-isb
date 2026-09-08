import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SaplingAutomationHistory from '../SaplingAutomationHistory.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/generic/useTranslationLoader', () => ({ useTranslationLoader: vi.fn() }))

describe('Automation email evidence', () => {
  it('renders independent deliveries with subject, recipients and an exact record link', async () => {
    const wrapper = mount(SaplingAutomationHistory, {
      props: {
        history: {
          executions: [],
          independentEmails: [
            {
              handle: 217,
              kind: 'email',
              subject: 'Ticket updated',
              toRecipients: ['customer@example.test'],
              status: 'success',
              attemptCount: 2,
              createdAt: '2026-09-07T10:00:00Z',
            },
          ],
          hasMore: false,
          page: 1,
        },
      },
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          VTable: { template: '<table><slot /></table>' },
          VAlert: { template: '<aside><slot /></aside>' },
          VExpansionPanels: true,
        },
      },
    })
    const cells = wrapper.findAll('tbody td').map((cell) => cell.text())
    expect(cells.slice(1)).toEqual([
      'Ticket updated',
      'customer@example.test',
      'automation.deliveryStatus.success',
      '2',
    ])
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({
      path: '/table/emailDelivery',
      query: { filter: JSON.stringify({ handle: 217 }) },
    })
    expect(wrapper.text()).toContain('automation.independentEmails')
    expect(wrapper.text()).not.toContain('automation.notDocumented')
    await wrapper.findComponent(RouterLinkStub).trigger('click')
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })
})
