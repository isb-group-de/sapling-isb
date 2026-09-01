import { describe, expect, it, vi } from 'vitest'
import { resolveApiError } from '../api.error.service'

vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({
    pushMessage: vi.fn(),
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    clear: vi.fn(),
  }),
}))

describe('api.error.service', () => {
  it('uses structured backend details for actionable descriptions', () => {
    const result = resolveApiError(
      {
        response: {
          status: 409,
          data: {
            message: 'global.deleteError',
            error: 'exception.deleteReferencedRecord',
            details: {
              summary: 'exception.deleteReferencedRecord',
              summaryKey: 'exception.deleteReferencedRecord',
              summaryParams: {
                entityHandle: 'favorite',
              },
              referencingEntityHandle: 'favorite',
            },
            technical: {
              exception: {
                code: '23503',
                constraint: 'favorite_item_person_handle_foreign',
              },
            },
          },
        },
        config: {
          method: 'delete',
          url: '/api/generic/person',
          params: { handle: 113 },
        },
      },
      'exception.unknownError',
    )

    expect(result.message).toBe('global.deleteError')
    expect(result.description).toBe('exception.deleteReferencedRecord')
    expect(result.descriptionParams).toEqual({
      entityHandle: 'favorite',
    })
    expect(result.technical).toMatchObject({
      client: {
        method: 'delete',
        url: '/api/generic/person',
        params: { handle: 113 },
      },
      response: {
        status: 409,
        data: {
          technical: {
            exception: {
              code: '23503',
            },
          },
        },
      },
    })
  })

  it('does not show generic HTTP client text as a user description', () => {
    const result = resolveApiError({
      message: 'Request failed with status code 500',
      response: {
        status: 500,
        data: {
          error: 'Internal Server Error',
        },
      },
    })

    expect(result.message).toBe('exception.serverException')
    expect(result.description).toBe('')
    expect(result.technical).toBeDefined()
  })

  it('never exposes an nginx HTML error page as the message', () => {
    const result = resolveApiError({
      response: {
        status: 502,
        statusText: 'Bad Gateway',
        data: '<html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>',
      },
    })

    expect(result.message).toBe('exception.serverException')
    expect(result.description).toBe('')
  })

  it('explains that a client network failure can be retried', () => {
    const result = resolveApiError({
      code: 'ERR_NETWORK',
      message: 'Network Error',
      config: {
        method: 'get',
        url: '/api/generic/ticketStatus',
      },
    })

    expect(result.message).toBe('exception.connectionException')
    expect(result.description).toBe('exception.connectionExceptionDescription')
  })
})
