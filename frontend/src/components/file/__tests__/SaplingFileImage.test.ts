import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SaplingFileImage from '../SaplingFileImage.vue'

function mountImage() {
  return mount(SaplingFileImage, {
    props: { imageUrl: '/document/download/1', mimeType: 'image/svg+xml' },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { SaplingFileNoPreview: true },
    },
  })
}

describe('SaplingFileImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads protected images with the canonical MIME type and releases each blob URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>']),
    })
    const createObjectURL = vi.fn().mockReturnValueOnce('blob:svg').mockReturnValueOnce('blob:ico')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const wrapper = mountImage()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/document/download/1', {
      credentials: 'include',
      signal: expect.any(AbortSignal),
    })
    expect(createObjectURL.mock.calls[0]![0].type).toBe('image/svg+xml')
    expect(wrapper.get('img').attributes('src')).toBe('blob:svg')
    expect(wrapper.find('svg, iframe, object, embed').exists()).toBe(false)

    await wrapper.setProps({
      imageUrl: '/document/download/2',
      mimeType: 'image/vnd.microsoft.icon',
    })
    await flushPromises()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:svg')
    expect(createObjectURL.mock.calls[1]![0].type).toBe('image/vnd.microsoft.icon')
    expect(wrapper.get('img').attributes('src')).toBe('blob:ico')
    wrapper.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:ico')
  })

  it('discards a pending download when the selection changes', async () => {
    let resolveBlob!: (blob: Blob) => void
    const pendingBlob = new Promise<Blob>((resolve) => {
      resolveBlob = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, blob: () => pendingBlob })
        .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['icon']) }),
    )
    const createObjectURL = vi.fn().mockReturnValue('blob:current')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    const wrapper = mountImage()
    await flushPromises()
    await wrapper.setProps({
      imageUrl: '/document/download/2',
      mimeType: 'image/vnd.microsoft.icon',
    })
    await flushPromises()
    resolveBlob(new Blob(['old svg']))
    await flushPromises()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(wrapper.get('img').attributes('src')).toBe('blob:current')
    wrapper.unmount()
  })

  it('shows the unavailable preview for failed downloads and image decoding errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['invalid image']) }),
    )
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:invalid', revokeObjectURL: vi.fn() })
    const wrapper = mountImage()
    await flushPromises()
    expect(wrapper.findComponent({ name: 'SaplingFileNoPreview' }).exists()).toBe(true)
    await wrapper.setProps({ imageUrl: '/document/download/2' })
    await flushPromises()
    await wrapper.get('img').trigger('error')
    expect(wrapper.findComponent({ name: 'SaplingFileNoPreview' }).exists()).toBe(true)
    wrapper.unmount()
  })
})
