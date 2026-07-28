import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export type SearchIndexRebuildState = 'idle' | 'running' | 'completed' | 'failed'

export interface SearchIndexRebuildStatus {
  state: SearchIndexRebuildState
  processedRecords: number
  indexedEntities: number
  indexedItems: number
  currentEntityHandle: string | null
  currentEntityProcessed: number
  currentEntityTotal: number
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  error: string | null
}

class ApiSearchIndexService {
  static async getRebuildStatus(): Promise<SearchIndexRebuildStatus> {
    const path = 'system/search-index/rebuild'

    try {
      const response = await axios.get<SearchIndexRebuildStatus>(buildApiUrl(path))
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'global.searchIndexStatusFailed', 'globalSearchIndex')
      throw error
    }
  }

  static async startRebuild(): Promise<SearchIndexRebuildStatus> {
    const path = 'system/search-index/rebuild'

    try {
      const response = await axios.post<SearchIndexRebuildStatus>(buildApiUrl(path))
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'global.searchIndexRebuildFailed', 'globalSearchIndex')
      throw error
    }
  }
}

export default ApiSearchIndexService
