import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import SaplingProfileAvatar from '../SaplingProfileAvatar.vue'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useProfilePictureStore } from '@/stores/profilePictureStore'
import type { PersonItem } from '@/entity/entity'

vi.mock('@/services/api.profile-picture.service', () => ({
  default: {
    list: async () => [],
    getImage: async () => new Blob(['image'], { type: 'image/png' }),
    getImageUrl: (handle: number) => `/api/current/profile-pictures/${handle}`,
  },
}))

describe('SaplingProfileAvatar', () => {
  let pinia: Pinia
  beforeEach(() => {
    let nextUrl = 0
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => `blob:profile-${++nextUrl}`)
        static revokeObjectURL = vi.fn()
      },
    )
    pinia = createPinia()
    setActivePinia(pinia)
    useCurrentPersonStore().person = { handle: 42 } as PersonItem
  })
  afterEach(() => {
    disposePinia(pinia)
    vi.unstubAllGlobals()
  })

  it('shows initials for missing and broken images, and recovers for the next picture', async () => {
    const wrapper = mount(SaplingProfileAvatar, {
      props: { name: 'Ada Example', initials: 'AE' },
      global: { plugins: [pinia] },
    })
    await flushPromises()
    expect(wrapper.text()).toBe('AE')
    const store = useProfilePictureStore()
    store.pictures = [
      {
        handle: 1,
        filename: 'first.png',
        mimetype: 'image/png',
        description: null,
        createdAt: null,
      },
    ]
    await flushPromises()
    expect(wrapper.get('img').attributes()).toMatchObject({
      src: 'blob:profile-1',
      alt: 'Ada Example',
      crossorigin: 'use-credentials',
    })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('AE')
    store.pictures = [{ ...store.pictures[0]!, handle: 2 }]
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toBe('blob:profile-2')
    wrapper.unmount()
  })
})
