import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSaplingImageEmbed, useSaplingMarkdownField } from './useSaplingMarkdownField'

const api = vi.hoisted(() => ({
  listProviders: vi.fn(),
  listModels: vi.fn(),
  prepareMarkdown: vi.fn(),
}))
const documentApi = vi.hoisted(() => ({
  upload: vi.fn(),
}))

vi.mock('@/services/api.ai.service', () => ({ default: api }))
vi.mock('@/services/api.document.service', () => ({ default: documentApi }))
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

function mountHarness(
  maxLength?: number,
  recordContext?: { entityHandle?: string; itemHandle?: string | number },
) {
  return mount(
    defineComponent({
      setup() {
        return useSaplingMarkdownField({
          modelValue: () => 'Vorhandener Inhalt',
          rows: () => 6,
          label: () => 'Beschreibung',
          maxLength: () => maxLength,
          entityHandle: () => recordContext?.entityHandle,
          itemHandle: () => recordContext?.itemHandle,
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
    documentApi.upload.mockResolvedValue({
      handle: 42,
      filename: 'screenshot.png',
      mimetype: 'image/png',
    })
  })

  it('keeps AI preparation disabled without a configured chat runtime', async () => {
    const wrapper = mountHarness()
    await flushPromises()

    expect(wrapper.get('[data-test="prepare-with-ai"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="prepare-with-ai"]').trigger('click')
    expect(api.prepareMarkdown).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('organizes Markdown actions into stable palette groups', async () => {
    const wrapper = mountHarness()
    await flushPromises()

    expect(
      Object.fromEntries(
        ['structure', 'text', 'lists', 'media', 'code'].map((group) => [
          group,
          wrapper.vm.toolbarActions
            .filter((action) => action.group === group)
            .map((action) => action.key),
        ]),
      ),
    ).toEqual({
      structure: ['heading1', 'heading', 'heading3', 'quote', 'divider'],
      text: ['bold', 'italic', 'strike', 'link'],
      lists: ['list', 'ordered-list', 'checklist'],
      media: ['image', 'table'],
      code: ['inline-code', 'code-block'],
    })

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

  it('uploads selected images as documents and embeds them in selection order', async () => {
    documentApi.upload
      .mockResolvedValueOnce({ handle: 42, filename: 'first.png', mimetype: 'image/png' })
      .mockResolvedValueOnce({ handle: 43, filename: 'second.jpg', mimetype: 'image/jpeg' })
    const wrapper = mountHarness(undefined, { entityHandle: 'ticket', itemHandle: 218 })
    await flushPromises()

    const uploaded = await wrapper.vm.uploadImages([
      new File(['first'], 'first.png', { type: 'image/png' }),
      new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
    ])

    expect(uploaded).toBe(2)
    expect(documentApi.upload).toHaveBeenCalledTimes(2)
    expect(documentApi.upload.mock.calls[0]?.[0]).toBe('ticket')
    expect(documentApi.upload.mock.calls[0]?.[1]).toBe('218')
    expect((documentApi.upload.mock.calls[0]?.[2] as FormData).get('typeHandle')).toBe('document')
    expect(wrapper.vm.draftValue).toContain(
      '{{sapling-image:42|first}}\n\n{{sapling-image:43|second}}',
    )
    expect(wrapper.vm.previewValue).toBe(wrapper.vm.draftValue)

    wrapper.unmount()
  })

  it('does not upload an inline image before the record has a stable handle', async () => {
    const wrapper = mountHarness(undefined, { entityHandle: 'ticket' })
    await flushPromises()

    expect(wrapper.vm.showImageUpload).toBe(true)
    expect(wrapper.vm.canUploadImage).toBe(false)
    expect(
      await wrapper.vm.uploadImages([new File(['image'], 'image.png', { type: 'image/png' })]),
    ).toBe(0)
    expect(documentApi.upload).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('builds a safe inline image label from the uploaded filename', () => {
    expect(buildSaplingImageEmbed(7, 'Schritt } eins.png', 'Bild')).toBe(
      '{{sapling-image:7|Schritt eins}}',
    )
  })

  it('inserts already referenced images in the provided selection order', async () => {
    const wrapper = mountHarness(undefined, { entityHandle: 'ticket', itemHandle: 218 })
    await flushPromises()

    const inserted = wrapper.vm.insertReferencedImages([
      {
        handle: 91,
        filename: 'second-step.jpg',
        mimetype: 'image/jpeg',
        description: null,
        createdAt: null,
      },
      {
        handle: 90,
        filename: 'first-step.png',
        mimetype: 'image/png',
        description: null,
        createdAt: null,
      },
    ])

    expect(inserted).toBe(2)
    expect(wrapper.vm.draftValue).toContain(
      '{{sapling-image:91|second-step}}\n\n{{sapling-image:90|first-step}}',
    )
    expect(wrapper.vm.previewValue).toBe(wrapper.vm.draftValue)

    wrapper.unmount()
  })
})
