import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), update: vi.fn() }))
vi.mock('axios', () => ({
  default: { get: mocks.get, post: mocks.post, isAxiosError: () => false },
}))
vi.mock('@/services/api.generic.service', () => ({ default: { update: mocks.update } }))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/generic/useTranslationLoader', () => ({ useTranslationLoader: () => ({}) }))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))
import AiPromptWorkbench from '../AiPromptWorkbench.vue'

describe('Prompt workbench publication workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const item = {
      handle: 'chat.base',
      title: 'Songbird',
      purpose: 'chat',
      description: '',
      draft: 'Original',
      variables: [],
    }
    mocks.get.mockImplementation(async (url: string) => ({
      data: url.endsWith('/usage')
        ? ['api/ai/prompts/ai.prompts.ts']
        : url.endsWith('/versions')
          ? []
          : [{ ...item }],
    }))
    mocks.update.mockImplementation(
      async (_entity: string, _handle: string, data: { draft: string }) => {
        item.draft = data.draft
      },
    )
    mocks.post.mockResolvedValue({ data: {} })
  })

  it('saves through generic CRUD, shows usages, and publishes only on the separate action', async () => {
    const wrapper = shallowMount(AiPromptWorkbench, {
      global: {
        renderStubDefaultSlot: true,
        stubs: {
          VBtn: { template: '<button><slot /></button>' },
          VListItem: {
            props: ['title'],
            template: '<button class="prompt-option">{{ title }}</button>',
          },
          VSelect: true,
          VProgressLinear: true,
        },
      },
    })
    await flushPromises()
    await wrapper.get('.prompt-option').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('api/ai/prompts/ai.prompts.ts')
    wrapper.findComponent({ name: 'SaplingTextarea' }).vm.$emit('update:modelValue', 'Edited')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'aiPrompt.saveDraft')!
      .trigger('click')
    await flushPromises()
    expect(mocks.update).toHaveBeenCalledWith('aiPromptTemplate', 'chat.base', { draft: 'Edited' })
    expect(mocks.post).not.toHaveBeenCalled()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'aiPrompt.publish')!
      .trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/api/ai/prompts/chat.base/publish', { changeNote: '' })
    wrapper.unmount()
  })
})
