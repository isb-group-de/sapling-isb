import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingAiChatImages from './SaplingAiChatImages.vue'
import ApiAiService from '@/services/api.ai.service'

vi.mock('@/services/api.ai.service', () => ({ default: { getChatImage: vi.fn() } }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

function createWrapper() {
  return mount(SaplingAiChatImages, {
    props: { images: [{ handle: 7, filename: 'screen.png' }], closable: true },
    global: {
      stubs: {
        VChip: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        SaplingImagePreviewDialog: true,
      },
    },
  })
}

describe('chat image badge previews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:chat-image')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(ApiAiService.getChatImage).mockResolvedValue(new Blob(['image']))
  })

  it('loads only on badge click and opens the existing zoom dialog', async () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('screen.png')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(ApiAiService.getChatImage).not.toHaveBeenCalled()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(ApiAiService.getChatImage).toHaveBeenCalledWith(7)
    const dialog = wrapper.getComponent({ name: 'SaplingImagePreviewDialog' })
    expect(dialog.attributes('src')).toBe('blob:chat-image')
    expect(dialog.attributes('alt')).toBe('screen.png')
    dialog.vm.$emit('close')
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chat-image')
    wrapper.unmount()
  })

  it('ignores an in-flight preview when the attachment is removed', async () => {
    let resolve!: (blob: Blob) => void
    vi.mocked(ApiAiService.getChatImage).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const wrapper = createWrapper()
    await wrapper.get('button').trigger('click')
    await wrapper.setProps({ images: [] })
    resolve(new Blob(['image']))
    await flushPromises()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'SaplingImagePreviewDialog' }).exists()).toBe(false)
    wrapper.unmount()
  })
})
