import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushApiErrorMessage } from '@/services/api.error.service'
import ApiFieldPermissionService from './api.field-permission.service'

vi.mock('axios', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}))
vi.mock('@/services/api.client', () => ({ buildApiUrl: (path: string) => `/api/${path}` }))
vi.mock('@/services/api.error.service', () => ({ pushApiErrorMessage: vi.fn() }))

describe('ApiFieldPermissionService', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['load', () => ApiFieldPermissionService.getCatalog(3, 'ticket')],
    [
      'save',
      () =>
        ApiFieldPermissionService.saveOverrides(3, 'ticket', [
          { fieldName: 'title', allowRead: true, allowInsert: true, allowUpdate: false },
        ]),
    ],
  ])('reports %s failures through the message center error path', async (_action, request) => {
    const error = new Error('network unavailable')
    vi.mocked(axios.get).mockRejectedValue(error)
    vi.mocked(axios.put).mockRejectedValue(error)

    await expect(request()).rejects.toBe(error)

    expect(pushApiErrorMessage).toHaveBeenCalledWith(
      error,
      'exception.unknownError',
      'fieldPermission',
    )
  })
})
