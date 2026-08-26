import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApiGenericService from './api.generic.service'
import { pushApiErrorMessage } from '@/services/api.error.service'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isCancel: vi.fn(() => false),
  },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

function paginatedResponse<T>(data: T[], page: number, totalPages: number) {
  return {
    data: {
      data,
      meta: {
        total: data.length,
        page,
        limit: 100,
        totalPages,
        executionTime: 0,
      },
    },
  }
}

describe('ApiGenericService pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads every page with a stable maximum-100 order and deduplicates handles', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce(
        paginatedResponse(
          [
            { handle: 1, title: 'First' },
            { handle: 2, title: 'Old' },
          ],
          1,
          2,
        ),
      )
      .mockResolvedValueOnce(
        paginatedResponse(
          [
            { handle: 2, title: 'Current' },
            { handle: 3, title: 'Third' },
          ],
          2,
          2,
        ),
      )

    const result = await ApiGenericService.findAll<{ handle: number; title: string }>('entity', {
      orderBy: { title: 'ASC' },
      pageSize: 500,
    })

    expect(result).toEqual([
      { handle: 1, title: 'First' },
      { handle: 2, title: 'Current' },
      { handle: 3, title: 'Third' },
    ])
    expect(axios.get).toHaveBeenNthCalledWith(1, '/api/generic/entity', {
      params: {
        page: 1,
        limit: 100,
        orderBy: JSON.stringify({ title: 'ASC', handle: 'ASC' }),
      },
      signal: undefined,
    })
    expect(axios.get).toHaveBeenNthCalledWith(2, '/api/generic/entity', {
      params: {
        page: 2,
        limit: 100,
        orderBy: JSON.stringify({ title: 'ASC', handle: 'ASC' }),
      },
      signal: undefined,
    })
  })

  it('uses only the generic handle field when no entity-specific order is requested', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce(paginatedResponse([], 1, 1))

    await ApiGenericService.findAll('entityGroup', {
      relations: ['parent'],
    })

    expect(axios.get).toHaveBeenCalledWith('/api/generic/entityGroup', {
      params: {
        page: 1,
        limit: 100,
        orderBy: JSON.stringify({ handle: 'ASC' }),
        relations: JSON.stringify(['parent']),
      },
      signal: undefined,
    })
  })

  it('splits large handle lookups into batches of at most 100', async () => {
    vi.mocked(axios.get).mockImplementation((_url, config) => {
      const filter = JSON.parse(
        String((config?.params as Record<string, unknown> | undefined)?.filter),
      ) as {
        handle: { $in: number[] }
      }
      return Promise.resolve(paginatedResponse([], 1, 1)).then((response) => ({
        ...response,
        data: {
          ...response.data,
          data: filter.handle.$in.map((handle) => ({ handle })),
        },
      }))
    })

    const handles = Array.from({ length: 205 }, (_, index) => index + 1)
    const result = await ApiGenericService.findByHandles<{ handle: number }>('person', handles)

    expect(result).toHaveLength(205)
    expect(axios.get).toHaveBeenCalledTimes(3)
    const batchSizes = vi.mocked(axios.get).mock.calls.map(([, config]) => {
      const filter = JSON.parse(
        String((config?.params as Record<string, unknown> | undefined)?.filter),
      ) as {
        handle: { $in: number[] }
      }
      return filter.handle.$in.length
    })
    expect(batchSizes).toEqual([100, 100, 5])
  })

  it('keeps explicitly silent bootstrap reads out of the message center', async () => {
    const error = new Error('backend is starting')
    vi.mocked(axios.get).mockRejectedValueOnce(error)

    await expect(
      ApiGenericService.findAll('translation', { suppressErrorMessage: true }),
    ).rejects.toBe(error)

    expect(pushApiErrorMessage).not.toHaveBeenCalled()
  })
})
