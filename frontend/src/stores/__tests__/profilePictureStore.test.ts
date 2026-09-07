import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useCurrentPersonStore } from '../currentPersonStore'
import { useProfilePictureStore } from '../profilePictureStore'
import ApiProfilePictureService from '@/services/api.profile-picture.service'
import type { PersonItem } from '@/entity/entity'

vi.mock('@/services/api.profile-picture.service', () => ({
  default: {
    list: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    getImage: vi.fn(),
    getImageUrl: (handle: number) => `/api/current/profile-pictures/${handle}`,
  },
}))

const picture = (handle: number) => ({
  handle,
  filename: `${handle}.png`,
  mimetype: 'image/png',
  description: null,
  createdAt: null,
})

describe('profile picture state', () => {
  let pinia: Pinia
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
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
    vi.mocked(ApiProfilePictureService.list).mockResolvedValue([picture(2), picture(1)])
    vi.mocked(ApiProfilePictureService.getImage).mockResolvedValue(
      new Blob(['image'], { type: 'image/png' }),
    )
    useCurrentPersonStore().person = { handle: 42 } as PersonItem
  })
  afterEach(() => {
    disposePinia(pinia)
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shares the list and advances only after a full minute, with pause and wraparound', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    expect(useProfilePictureStore()).toBe(store)
    expect(ApiProfilePictureService.list).toHaveBeenCalledTimes(1)
    expect(store.activeUrl).toBe('blob:profile-1')
    await vi.advanceTimersByTimeAsync(59_999)
    expect(store.activePicture?.handle).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(store.activePicture?.handle).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(store.activePicture?.handle).toBe(2)
    expect(ApiProfilePictureService.getImage).toHaveBeenCalledTimes(2)
    store.paused = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(store.activePicture?.handle).toBe(2)
    store.select(-1)
    expect(store.activePicture?.handle).toBe(1)
  })

  it('does not rotate when reduced motion is requested', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    store.reducedMotion = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(store.activePicture?.handle).toBe(2)
  })

  it('keeps successful uploads when another file fails and updates the avatar immediately', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    vi.mocked(ApiProfilePictureService.upload)
      .mockResolvedValueOnce(picture(3))
      .mockRejectedValueOnce(new Error('network'))
    await store.upload([
      new File(['png'], 'good.png'),
      new File(['png'], 'failed.png'),
      new File(['html'], 'bad.html'),
    ])
    expect(store.pictures.map((item) => item.handle)).toEqual([3, 2, 1])
    expect(store.activePicture?.handle).toBe(3)
    expect(store.failedUploads).toEqual(['failed.png', 'bad.html'])
    expect(store.busy).toBe(false)
  })

  it('removes pictures immediately and restores initials after the final deletion', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    await store.remove(2)
    expect(store.activePicture?.handle).toBe(1)
    await store.remove(1)
    expect(store.activeUrl).toBe('')
    expect(store.activeIndex).toBe(0)
  })

  it('does not remove the visible picture on a failed deletion', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    vi.mocked(ApiProfilePictureService.remove).mockRejectedValueOnce(new Error('denied'))
    await store.remove(2)
    expect(store.activePicture?.handle).toBe(2)
    expect(store.error).toBe('account.profilePicturesDeleteFailed')
  })

  it('discards late metadata after the authenticated person changes', async () => {
    let resolve!: (value: ReturnType<typeof picture>[]) => void
    vi.mocked(ApiProfilePictureService.list).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const store = useProfilePictureStore()
    useCurrentPersonStore().person = null
    resolve([picture(99)])
    await flushPromises()
    expect(store.pictures).toEqual([])
    expect(store.activeUrl).toBe('')
  })

  it('blocks self-service mutations during impersonation', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    useCurrentPersonStore().person = {
      handle: 42,
      _impersonator: { handle: 1, lastName: 'Admin' },
    } as unknown as PersonItem
    await store.upload([new File(['png'], 'photo.png')])
    await store.remove(2)
    expect(ApiProfilePictureService.upload).not.toHaveBeenCalled()
    expect(ApiProfilePictureService.remove).not.toHaveBeenCalled()
  })

  it('releases cached images on deletion and sign-out', async () => {
    const store = useProfilePictureStore()
    await flushPromises()
    await store.remove(2)
    await flushPromises()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-1')
    useCurrentPersonStore().person = null
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-2')
    expect(store.activeUrl).toBe('')
  })

  it('discards late image downloads after sign-out', async () => {
    let resolve!: (value: Blob) => void
    vi.mocked(ApiProfilePictureService.getImage).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const store = useProfilePictureStore()
    await flushPromises()
    useCurrentPersonStore().person = null
    resolve(new Blob(['image']))
    await flushPromises()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(store.activeUrl).toBe('')
  })
})
