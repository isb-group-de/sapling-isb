import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ApiCustomer360Service from './api.customer360.service'

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiCustomer360Service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the company summary from the dedicated endpoint', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { anchorEntityHandle: 'company' } })

    await ApiCustomer360Service.getSummary('company', 42)

    expect(axios.get).toHaveBeenCalledWith('/api/customer-360/company/42/summary', {
      params: undefined,
    })
  })

  it('serializes activity filters and related pagination', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: {} })

    await ApiCustomer360Service.getActivity('person', 7, {
      before: '2026-07-22T10:00:00.000Z',
      limit: 15,
      kinds: ['call', 'emailInbound'],
    })
    await ApiCustomer360Service.getRelated('person', 7, 'contracts', 3, 10)

    expect(axios.get).toHaveBeenNthCalledWith(1, '/api/customer-360/person/7/activity', {
      params: {
        before: '2026-07-22T10:00:00.000Z',
        after: undefined,
        limit: 15,
        kinds: 'call,emailInbound',
        direction: undefined,
      },
    })
    expect(axios.get).toHaveBeenNthCalledWith(2, '/api/customer-360/person/7/related/contracts', {
      params: { page: 3, limit: 10, filter: undefined },
    })
  })

  it('serializes related chip filters for server-side pagination', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: {} })

    await ApiCustomer360Service.getRelated('company', 42, 'tickets', 1, 20, {
      status: { handle: { $in: ['open', 'waiting'] } },
    })

    expect(axios.get).toHaveBeenCalledWith('/api/customer-360/company/42/related/tickets', {
      params: {
        page: 1,
        limit: 20,
        filter: JSON.stringify({ status: { handle: { $in: ['open', 'waiting'] } } }),
      },
    })
  })
})
