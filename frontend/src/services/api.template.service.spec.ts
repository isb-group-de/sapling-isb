import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushApiErrorMessage } from '@/services/api.error.service'
import ApiTemplateService from './api.template.service'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiTemplateService error reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ApiTemplateService.invalidate()
  })

  it('keeps bootstrap template requests silent when requested', async () => {
    const error = new Error('backend is starting')
    vi.mocked(axios.get).mockRejectedValueOnce(error)

    await expect(
      ApiTemplateService.getEntityTemplate('dashboard', false, {
        suppressErrorMessage: true,
      }),
    ).rejects.toBe(error)

    expect(pushApiErrorMessage).not.toHaveBeenCalled()
  })

  it('still reports regular template request failures', async () => {
    const error = new Error('request failed')
    vi.mocked(axios.get).mockRejectedValueOnce(error)

    await expect(ApiTemplateService.getEntityTemplate('ticket')).rejects.toBe(error)

    expect(pushApiErrorMessage).toHaveBeenCalledWith(error, 'exception.unknownError', 'ticket')
  })
})
