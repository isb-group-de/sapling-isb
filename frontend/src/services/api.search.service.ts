import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export type GlobalSearchRecordHandle = string | number

export interface GlobalSearchMatch {
  field: string
  value: string
}

export interface GlobalSearchResultItem {
  entityHandle: string
  recordHandle: GlobalSearchRecordHandle
  label: string
  preview?: string
  icon?: string | null
  path?: string
  score: number
  matches: GlobalSearchMatch[]
}

export interface GlobalSearchResponse {
  query: string
  items: GlobalSearchResultItem[]
}

interface GlobalSearchOptions {
  limit?: number
  entityHandles?: string[]
  signal?: AbortSignal
}

class ApiSearchService {
  static async global(
    query: string,
    { limit, entityHandles, signal }: GlobalSearchOptions = {},
  ): Promise<GlobalSearchResponse> {
    const params: Record<string, unknown> = { query, _: Date.now() }

    if (typeof limit === 'number') {
      params.limit = limit
    }

    if (entityHandles && entityHandles.length > 0) {
      params.entityHandles = entityHandles.join(',')
    }

    try {
      const response = await axios.get<GlobalSearchResponse>(
        buildApiUrl('command-palette/records'),
        {
          params,
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          signal,
        },
      )
      return response.data
    } catch (error: unknown) {
      if (isRequestCanceled(error)) {
        throw error
      }

      pushApiErrorMessage(error, 'exception.unknownError', 'global')
      throw error
    }
  }
}

function isRequestCanceled(error: unknown): boolean {
  return (
    axios.isCancel(error) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_CANCELED')
  )
}

export default ApiSearchService
