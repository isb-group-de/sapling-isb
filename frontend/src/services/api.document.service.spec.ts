import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApiDocumentService from './api.document.service'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiDocumentService referenced images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads images from the endpoint scoped by the exact entity and record reference', async () => {
    const images = [
      {
        handle: 7,
        filename: 'step.png',
        mimetype: 'image/png',
        description: null,
        createdAt: null,
      },
    ]
    vi.mocked(axios.get).mockResolvedValueOnce({ data: images })

    await expect(ApiDocumentService.getReferencedImages('ticket response', '218/2')).resolves.toBe(
      images,
    )

    expect(axios.get).toHaveBeenCalledWith(
      '/api/document/referenced-images/ticket%20response/218%2F2',
    )
  })

  it('builds the protected download URL for a selected image', () => {
    expect(ApiDocumentService.getDownloadUrl(7)).toBe('/api/document/download/7')
  })
})
