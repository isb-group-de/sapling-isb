import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushApiErrorMessage } from '@/services/api.error.service'
import ApiCurrentService from './api.current.service'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiCurrentService error reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps bootstrap person requests silent when requested', async () => {
    const error = new Error('backend is starting')
    vi.mocked(axios.get).mockRejectedValueOnce(error)

    await expect(ApiCurrentService.getPerson({ suppressErrorMessage: true })).rejects.toBe(error)

    expect(pushApiErrorMessage).not.toHaveBeenCalled()
  })

  it('still reports regular current-user request failures', async () => {
    const error = new Error('request failed')
    vi.mocked(axios.get).mockRejectedValueOnce(error)

    await expect(ApiCurrentService.getPerson()).rejects.toBe(error)

    expect(pushApiErrorMessage).toHaveBeenCalledWith(
      error,
      'exception.unknownError',
      'current/person',
    )
  })
})
