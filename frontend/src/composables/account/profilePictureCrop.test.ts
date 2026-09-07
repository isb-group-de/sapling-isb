import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { exportProfilePictureCrop, getProfilePictureCrop } from './profilePictureCrop'
import { useProfilePictureCrop } from './useProfilePictureCrop'

describe('profile picture crop geometry', () => {
  it('centers portrait and landscape images without stretching', () => {
    expect(getProfilePictureCrop(1200, 800, 1, 600, 400)).toEqual({ x: 200, y: 0, size: 800 })
    expect(getProfilePictureCrop(800, 1200, 1, 400, 600)).toEqual({ x: 0, y: 200, size: 800 })
  })
  it('clamps dragging at image edges and applies zoom in source coordinates', () => {
    expect(getProfilePictureCrop(1200, 800, 2, 600, 400)).toEqual({ x: 400, y: 200, size: 400 })
    expect(getProfilePictureCrop(1200, 800, 2, -1000, 5000)).toEqual({ x: 0, y: 400, size: 400 })
    expect(getProfilePictureCrop(1200, 800, 1, 5000, -1000)).toEqual({ x: 400, y: 0, size: 800 })
  })
})

describe('browser crop lifecycle and export', () => {
  const drawImage = vi.fn()
  const clearRect = vi.fn()
  const close = vi.fn()
  let wrapper: ReturnType<typeof mount> | undefined
  const source = { width: 1200, height: 800, close } as unknown as ImageBitmap
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      clearRect,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' })),
    )
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(source))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function mountCrop(file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })) {
    const host = defineComponent({
      setup: () => useProfilePictureCrop(file),
      template: '<canvas ref="canvas" width="512" height="512" />',
    })
    const result = mount(host)
    wrapper = result
    return result
  }

  it('decodes locally, renders the crop, and supports pointer and keyboard alignment', async () => {
    const host = mountCrop()
    await flushPromises()
    expect(host.vm.crop).toEqual({ x: 200, y: 0, size: 800 })
    const canvas = host.get('canvas').element
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 256 } as DOMRect)
    canvas.setPointerCapture = vi.fn()
    canvas.hasPointerCapture = vi.fn(() => true)
    canvas.releasePointerCapture = vi.fn()
    host.vm.pointerDown({ pointerId: 1, button: 0, clientX: 100, clientY: 100 } as PointerEvent)
    host.vm.pointerMove({ pointerId: 1, clientX: 132, clientY: 100 } as PointerEvent)
    expect(host.vm.crop?.x).toBe(100)
    host.vm.pointerEnd({ pointerId: 1 } as PointerEvent)
    expect(host.vm.dragging).toBe(false)
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1)
    host.vm.keyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(host.vm.crop?.x).toBe(116)
    await host.vm.$nextTick()
    expect(drawImage).toHaveBeenLastCalledWith(source, 116, 0, 800, 800, 0, 0, 512, 512)
    host.vm.reset()
    expect(host.vm.crop?.x).toBe(200)
  })

  it('exports the selected square as PNG and does not upscale small crops', async () => {
    const result = await exportProfilePictureCrop(
      source,
      { x: 200, y: 100, size: 400 },
      'portrait.jpeg',
    )
    expect(result.name).toBe('portrait.png')
    expect(result.type).toBe('image/png')
    expect(drawImage).toHaveBeenLastCalledWith(source, 200, 100, 400, 400, 0, 0, 400, 400)
    await exportProfilePictureCrop(source, { x: 0, y: 0, size: 2000 }, 'large.webp')
    expect(drawImage).toHaveBeenLastCalledWith(source, 0, 0, 2000, 2000, 0, 0, 1024, 1024)
  })

  it('reports corrupt images and refuses unsupported inputs before decoding', async () => {
    const host = mountCrop(new File(['svg'], 'image.svg', { type: 'image/svg+xml' }))
    await flushPromises()
    expect(createImageBitmap).not.toHaveBeenCalled()
    expect(host.vm.error).toBe('account.profileCropLoadFailed')
    expect(host.vm.loading).toBe(false)
  })

  it('keeps export errors retryable', async () => {
    const host = mountCrop()
    await flushPromises()
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce((callback) =>
      callback(null),
    )
    expect(await host.vm.exportFile()).toBeNull()
    expect(host.vm.error).toBe('account.profileCropFailed')
    expect(host.vm.exporting).toBe(false)
    expect(await host.vm.exportFile()).toBeInstanceOf(File)
  })

  it('releases decoded images when closed, including a late decode', async () => {
    let resolve!: (bitmap: ImageBitmap) => void
    vi.mocked(createImageBitmap).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const host = mountCrop()
    host.unmount()
    wrapper = undefined
    resolve(source)
    await flushPromises()
    expect(close).toHaveBeenCalledTimes(1)
  })
})
