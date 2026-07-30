import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApiMailService from './api.mail.service'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiMailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(axios.get).mockResolvedValue({ data: { senders: [] } })
  })

  it('passes the current entity context when loading sender options', async () => {
    await ApiMailService.listSenders('ticket')

    expect(axios.get).toHaveBeenCalledWith('/api/mail/senders', {
      params: { entityHandle: 'ticket' },
    })
  })

  it('keeps sender lookup context-free when no entity is provided', async () => {
    await ApiMailService.listSenders()

    expect(axios.get).toHaveBeenCalledWith('/api/mail/senders', {
      params: undefined,
    })
  })
})
