import axios from 'axios'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem } from '@/entity/entity'
import type { EntityHandleValue } from './api.generic.service'
import { buildApiUrl } from './api.client'
import { pushApiErrorMessage } from './api.error.service'

export type RecordMergeSource = 'loser' | 'winner'
export interface RecordMergePair {
  loserHandle: EntityHandleValue
  winnerHandle: EntityHandleValue
}
export interface RecordMergeField {
  property: string
  template: EntityTemplate
  loserValue: unknown
  winnerValue: unknown
  selectedSource: RecordMergeSource
  selectable: boolean
}
export interface RecordMergePreview {
  loser: SaplingGenericItem
  winner: SaplingGenericItem
  fields: RecordMergeField[]
  previewToken: string
}
export interface RecordMergeRequest extends RecordMergePair {
  previewToken: string
  selections: Record<string, RecordMergeSource>
}
export interface RecordMergeResult {
  winner: SaplingGenericItem
  deletedHandle: EntityHandleValue
}

export default class ApiMergeService {
  static async preview(entity: string, pair: RecordMergePair): Promise<RecordMergePreview> {
    return this.post<RecordMergePreview>(entity, '/preview', pair)
  }

  static async merge(entity: string, request: RecordMergeRequest): Promise<RecordMergeResult> {
    return this.post<RecordMergeResult>(entity, '', request)
  }

  private static async post<T>(
    entity: string,
    suffix: string,
    request: RecordMergePair,
  ): Promise<T> {
    try {
      const response = await axios.post<T>(
        buildApiUrl(`generic/${encodeURIComponent(entity)}/merge${suffix}`),
        request,
      )
      return response.data
    } catch (error) {
      pushApiErrorMessage(error, 'exception.unknownError', entity)
      throw error
    }
  }
}
