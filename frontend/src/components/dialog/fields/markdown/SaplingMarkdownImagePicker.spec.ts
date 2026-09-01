import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingMarkdownImagePicker from './SaplingMarkdownImagePicker.vue'

const documentApi = vi.hoisted(() => ({
  getReferencedImages: vi.fn(),
  getDownloadUrl: vi.fn((handle: number) => `/api/document/download/${handle}`),
}))
const translationLoader = vi.hoisted(() => vi.fn(() => ({ isLoading: { value: false } })))

vi.mock('@/services/api.document.service', () => ({ default: documentApi }))
vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: translationLoader,
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    d: (value: Date) => value.toISOString(),
    t: (key: string) => key,
  }),
}))

const images = [
  {
    handle: 7,
    filename: 'first.png',
    mimetype: 'image/png',
    description: 'First',
    createdAt: null,
  },
  {
    handle: 9,
    filename: 'second.jpg',
    mimetype: 'image/jpeg',
    description: 'Second',
    createdAt: null,
  },
]

describe('SaplingMarkdownImagePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentApi.getReferencedImages.mockResolvedValue(images)
  })

  it('loads only through the endpoint scoped to the current record', async () => {
    shallowMount(SaplingMarkdownImagePicker, {
      props: {
        modelValue: true,
        entityHandle: 'ticket',
        itemHandle: 218,
      },
    })
    await flushPromises()

    expect(documentApi.getReferencedImages).toHaveBeenCalledTimes(1)
    expect(documentApi.getReferencedImages).toHaveBeenCalledWith('ticket', '218')
    expect(translationLoader).toHaveBeenCalledWith('markdownImagePicker')
  })

  it('emits selected images in the order chosen by the user', async () => {
    const wrapper = shallowMount(SaplingMarkdownImagePicker, {
      props: {
        modelValue: true,
        entityHandle: 'ticket',
        itemHandle: 218,
      },
    })
    await flushPromises()

    const picker = wrapper.vm as unknown as {
      toggleSelection: (handle: number) => void
      insertSelected: () => void
    }
    picker.toggleSelection(9)
    picker.toggleSelection(7)
    picker.insertSelected()

    expect(wrapper.emitted('insert')?.[0]).toEqual([[images[1], images[0]]])
    const visibilityEvents = wrapper.emitted('update:modelValue') ?? []
    expect(visibilityEvents[visibilityEvents.length - 1]).toEqual([false])
  })
})
