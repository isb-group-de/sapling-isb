import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaplingMarkdownField } from './useSaplingMarkdownField'

const api = vi.hoisted(() => ({
  listProviders: vi.fn(),
  listModels: vi.fn(),
  prepareMarkdown: vi.fn(),
}))

vi.mock('@/services/api.ai.service', () => ({ default: api }))
vi.mock('@/services/cookie.service', () => ({
  default: { get: vi.fn(() => 'light') },
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'de' },
    t: (key: string) => key,
  }),
}))
vi.mock('@/composables/fields/useSaplingMarkdownVoiceInput', () => ({
  useSaplingMarkdownVoiceInput: () => ({
    canTranscribeWithAi: false,
    isRecordingVoiceInput: false,
    isTranscribingVoiceInput: false,
    toggleVoiceInput: vi.fn(),
  }),
}))

function mountHarness(maxLength?: number) {
  return mount(
    defineComponent({
      setup() {
        return useSaplingMarkdownField({
          modelValue: () => 'Vorhandener Inhalt',
          rows: () => 6,
          label: () => 'Beschreibung',
          maxLength: () => maxLength,
          emit: vi.fn(),
        })
      },
      template: `
        <button
          data-test="prepare-with-ai"
          :disabled="!canPrepareWithAi"
          @click="prepareWithAi()"
        />
      `,
    }),
  )
}

describe('useSaplingMarkdownField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    api.listProviders.mockResolvedValue([])
    api.listModels.mockResolvedValue([])
    api.prepareMarkdown.mockResolvedValue({ content: 'Aufbereiteter Inhalt' })
  })

  it('keeps AI preparation disabled without a configured chat runtime', async () => {
    const wrapper = mountHarness()
    await flushPromises()

    expect(wrapper.get('[data-test="prepare-with-ai"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="prepare-with-ai"]').trigger('click')
    expect(api.prepareMarkdown).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('enables AI preparation when a configured provider and model are available', async () => {
    api.listProviders.mockResolvedValue([{ handle: 'openai' }])
    api.listModels.mockResolvedValue([
      {
        handle: 'openai-gpt-5_6-sol',
        provider: 'openai',
        isDefault: true,
      },
    ])
    const wrapper = mountHarness()
    await flushPromises()

    expect(wrapper.get('[data-test="prepare-with-ai"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="prepare-with-ai"]').trigger('click')
    await flushPromises()

    expect(api.prepareMarkdown).toHaveBeenCalledWith({
      content: 'Vorhandener Inhalt',
      providerHandle: 'openai',
      modelHandle: 'openai-gpt-5_6-sol',
    })

    wrapper.unmount()
  })

  it('falls back to the configured default when saved AI preferences are stale', async () => {
    window.localStorage.setItem('sapling.aiPreference.chatProviderHandle', 'openai')
    window.localStorage.setItem('sapling.aiPreference.chatModelHandle', 'missing-model')
    api.listProviders.mockResolvedValue([{ handle: 'openai' }])
    api.listModels.mockResolvedValue([
      {
        handle: 'openai-gpt-5_6-sol',
        provider: 'openai',
        isDefault: true,
      },
    ])
    const wrapper = mountHarness()
    await flushPromises()

    await wrapper.get('[data-test="prepare-with-ai"]').trigger('click')
    await flushPromises()

    expect(api.prepareMarkdown).toHaveBeenCalledWith({
      content: 'Vorhandener Inhalt',
      providerHandle: 'openai',
      modelHandle: 'openai-gpt-5_6-sol',
    })

    wrapper.unmount()
  })

  it('truncates editor updates at the configured maximum and reports the remaining space', async () => {
    const wrapper = mountHarness(20)
    await flushPromises()

    wrapper.vm.updateDraftValue('1234567890123456789012345')

    expect(wrapper.vm.draftValue).toBe('12345678901234567890')
    expect(wrapper.vm.remainingCharacters).toBe(0)

    wrapper.unmount()
  })

  it('truncates AI-prepared Markdown before updating the draft', async () => {
    api.listProviders.mockResolvedValue([{ handle: 'openai' }])
    api.listModels.mockResolvedValue([
      {
        handle: 'openai-gpt-5_6-sol',
        provider: 'openai',
        isDefault: true,
      },
    ])
    api.prepareMarkdown.mockResolvedValue({ content: '1234567890123456789012345' })
    const wrapper = mountHarness(20)
    await flushPromises()

    await wrapper.vm.prepareWithAi()

    expect(wrapper.vm.draftValue).toBe('12345678901234567890')
    expect(wrapper.vm.previewValue).toBe('12345678901234567890')

    wrapper.unmount()
  })
})
