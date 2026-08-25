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

function mountHarness() {
  return mount(
    defineComponent({
      setup() {
        return useSaplingMarkdownField({
          modelValue: () => 'Vorhandener Inhalt',
          rows: () => 6,
          label: () => 'Beschreibung',
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
    api.listModels.mockResolvedValue([{ handle: 'openai-gpt-5_6-sol' }])
    const wrapper = mountHarness()
    await flushPromises()

    expect(wrapper.get('[data-test="prepare-with-ai"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-test="prepare-with-ai"]').trigger('click')
    await flushPromises()

    expect(api.prepareMarkdown).toHaveBeenCalledWith({
      content: 'Vorhandener Inhalt',
      providerHandle: undefined,
      modelHandle: undefined,
    })

    wrapper.unmount()
  })
})
