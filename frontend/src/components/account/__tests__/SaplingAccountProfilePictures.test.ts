import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useProfilePictureStore } from '@/stores/profilePictureStore'
import type { PersonItem } from '@/entity/entity'
import SaplingAccountProfilePictures from '../SaplingAccountProfilePictures.vue'
import SaplingProfilePictureCropDialog from '../SaplingProfilePictureCropDialog.vue'

vi.mock('@/services/api.profile-picture.service', () => ({ default: { list: async () => [] } }))

describe('account-only upload cropping', () => {
  let pinia: Pinia
  let wrapper: ReturnType<typeof mount>
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    useCurrentPersonStore().person = { handle: 42 } as PersonItem
    wrapper = mount(SaplingAccountProfilePictures, {
      global: {
        plugins: [pinia],
        mocks: { $t: (key: string) => key },
        stubs: {
          SaplingProfileAvatar: true,
          SaplingProfilePictureCropDialog: true,
          VBtn: { template: '<button><slot /></button>' },
          VIcon: true,
          VAlert: true,
          VProgressLinear: true,
        },
      },
    })
  })
  afterEach(() => {
    wrapper.unmount()
    disposePinia(pinia)
    vi.restoreAllMocks()
  })

  async function choose(files: File[]) {
    await flushPromises()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
  }

  it('uploads only the confirmed crop and processes multiple images in order', async () => {
    const upload = vi.spyOn(useProfilePictureStore(), 'upload').mockResolvedValue()
    const originals = [new File(['one'], 'one.jpg'), new File(['two'], 'two.jpg')]
    await choose(originals)
    expect(upload).not.toHaveBeenCalled()
    const first = wrapper.findComponent(SaplingProfilePictureCropDialog)
    expect(first.props('file')).toBe(originals[0])
    const cropped = new File(['cropped'], 'one.png', { type: 'image/png' })
    first.vm.$emit('save', cropped)
    await flushPromises()
    expect(upload).toHaveBeenCalledWith([cropped])
    expect(wrapper.findComponent(SaplingProfilePictureCropDialog).props('file')).toBe(originals[1])
    wrapper.findComponent(SaplingProfilePictureCropDialog).vm.$emit('cancel')
    await flushPromises()
    expect(wrapper.findComponent(SaplingProfilePictureCropDialog).exists()).toBe(false)
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('keeps the selected crop open on upload failure and lets the user skip it', async () => {
    const pictures = useProfilePictureStore()
    vi.spyOn(pictures, 'upload').mockImplementation(async () => {
      pictures.error = 'account.profilePicturesUploadFailed'
    })
    const originals = [new File(['one'], 'one.jpg'), new File(['two'], 'two.jpg')]
    await choose(originals)
    wrapper
      .findComponent(SaplingProfilePictureCropDialog)
      .vm.$emit('save', new File(['crop'], 'one.png'))
    await flushPromises()
    expect(wrapper.findComponent(SaplingProfilePictureCropDialog).props('file')).toBe(originals[0])
    expect(wrapper.findComponent(SaplingProfilePictureCropDialog).props('uploadError')).toBe(
      'account.profilePicturesUploadFailed',
    )
    wrapper.findComponent(SaplingProfilePictureCropDialog).vm.$emit('skip')
    await flushPromises()
    expect(wrapper.findComponent(SaplingProfilePictureCropDialog).props('file')).toBe(originals[1])
    expect(pictures.error).toBe('')
  })
})
