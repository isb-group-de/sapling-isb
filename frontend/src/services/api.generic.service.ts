import axios from 'axios'
import type { ChangeLogEntry, PaginatedResponse, TimelineResponse } from '../entity/structure'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'
import {
  DEFAULT_ENTITY_ITEMS_COUNT,
  GENERIC_API_MAX_PAGE_SIZE,
} from '@/constants/project.constants'

export type FilterQuery = { [key: string]: unknown }
export type OrderByQuery = { [key: string]: 'ASC' | 'DESC' | 1 | -1 | string }
export type EntityHandleValue = string | number
export type GenericUpdateConcurrencyResolution = 'detect' | 'merge' | 'overwrite'
export type GenericImportRowAction = 'created' | 'updated' | 'failed' | 'skipped'

export interface GenericImportRowResult {
  rowNumber: number
  action: GenericImportRowAction
  handle?: EntityHandleValue | null
  message?: string
}

export interface GenericImportResponse {
  totalRows: number
  created: number
  updated: number
  skipped: number
  failed: number
  rows: GenericImportRowResult[]
}

export interface GenericBulkUpdateTarget {
  handle: EntityHandleValue
  expectedUpdatedAt?: string | null
}

export interface GenericBulkUpdateRequest {
  targets: GenericBulkUpdateTarget[]
  changes: Record<string, unknown>
}

export interface GenericBulkUpdateResponse {
  updatedCount: number
  handles: string[]
}

export interface GenericDeleteReference {
  name: string
  entityHandle: string
  kind: '1:m'
}

export interface GenericDeleteImpact {
  action: 'delete' | 'cancel'
  references: GenericDeleteReference[]
}

export interface GenericDeleteResult {
  action: 'deleted' | 'canceled'
}

export interface GenericDeleteOptions {
  cascadeRelations?: string[]
}

export interface GenericUpdateConcurrency {
  expectedUpdatedAt?: string | Date | null
  basePayload?: Record<string, unknown> | null
  resolution?: GenericUpdateConcurrencyResolution
  merge?: boolean
  force?: boolean
}

export interface GenericUpdateConflictField {
  property: string
  baseValue?: unknown
  currentValue?: unknown
  attemptedValue?: unknown
  changedInCurrent: boolean
  changedInAttempt: boolean
  conflict: boolean
}

export interface GenericUpdateConflictLatestChange {
  handle?: string | number | null
  action?: string | null
  createdAt?: string | Date | null
  person?: Record<string, unknown> | null
}

export interface GenericUpdateConflictDetails {
  reason: 'staleRecord'
  entityHandle: string
  handle: EntityHandleValue
  expectedUpdatedAt?: string | null
  currentUpdatedAt?: string | null
  autoMergeable: boolean
  conflictingProperties: string[]
  mergeableProperties: string[]
  base?: Record<string, unknown> | null
  current?: Record<string, unknown> | null
  attempted?: Record<string, unknown> | null
  fields: GenericUpdateConflictField[]
  latestChange?: GenericUpdateConflictLatestChange | null
  summary?: string
}

export interface FindOptions {
  filter?: FilterQuery
  orderBy?: OrderByQuery
  page?: number
  limit?: number
  relations?: string[]
  fields?: string[]
  signal?: AbortSignal
}

export interface FindAllOptions extends Omit<FindOptions, 'page' | 'limit'> {
  pageSize?: number
}

export interface FindByHandlesOptions extends Omit<FindAllOptions, 'filter'> {
  filter?: FilterQuery
  handleField?: string
}

interface UpdateOptions {
  relations?: string[]
  concurrency?: GenericUpdateConcurrency
  suppressConflictMessage?: boolean
}

interface TimelineOptions {
  before?: string
  months?: number
}

class ApiGenericService {
  static async downloadJSON<T>(
    entityHandle: string,
    {
      filter,
      orderBy,
      relations,
    }: { filter?: FilterQuery; orderBy?: OrderByQuery; relations?: string[] } = {},
  ): Promise<T[]> {
    const params: Record<string, unknown> = {}
    if (filter && Object.keys(filter).length > 0) params.filter = JSON.stringify(filter)
    if (orderBy && Object.keys(orderBy).length > 0) {
      params.orderBy = JSON.stringify(orderBy)
    }
    if (relations && relations.length > 0) {
      params.relations = relations.join(',')
    }

    try {
      const response = await axios.get<T[]>(buildApiUrl(`generic/${entityHandle}/download`), {
        params,
      })
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async find<T>(
    entityHandle: string,
    { filter, orderBy, page, limit, relations, fields, signal }: FindOptions = {},
  ): Promise<PaginatedResponse<T>> {
    const params: Record<string, unknown> = {}
    if (typeof page === 'number') params.page = page
    if (typeof limit === 'number') params.limit = limit
    if (filter && Object.keys(filter).length > 0) {
      params.filter = JSON.stringify(filter)
    }
    if (orderBy && Object.keys(orderBy).length > 0) {
      params.orderBy = JSON.stringify(orderBy)
    }
    if (relations && relations.length > 0) {
      params.relations = JSON.stringify(relations)
    }
    if (fields && fields.length > 0) {
      params.fields = JSON.stringify(fields)
    }

    try {
      const response = await axios.get<PaginatedResponse<T>>(
        buildApiUrl(`generic/${entityHandle}`),
        { params, signal },
      )
      return response.data
    } catch (error: unknown) {
      if (isRequestCanceled(error)) {
        throw error
      }

      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async findAll<T>(
    entityHandle: string,
    {
      filter,
      orderBy,
      relations,
      fields,
      signal,
      pageSize = DEFAULT_ENTITY_ITEMS_COUNT,
    }: FindAllOptions = {},
  ): Promise<T[]> {
    const limit = Math.min(
      Math.max(Math.trunc(pageSize) || DEFAULT_ENTITY_ITEMS_COUNT, 1),
      GENERIC_API_MAX_PAGE_SIZE,
    )
    const stableOrderBy: OrderByQuery = {
      ...(orderBy ?? {}),
      handle: orderBy?.handle ?? 'ASC',
    }
    const items: T[] = []
    const handledItems = new Map<EntityHandleValue, number>()
    let page = 1
    let totalPages = 1

    do {
      const response = await this.find<T>(entityHandle, {
        filter,
        orderBy: stableOrderBy,
        page,
        limit,
        relations,
        fields,
        signal,
      })

      for (const item of response.data ?? []) {
        const handle = getItemHandle(item)
        if (handle == null) {
          items.push(item)
          continue
        }

        const existingIndex = handledItems.get(handle)
        if (existingIndex == null) {
          handledItems.set(handle, items.length)
          items.push(item)
        } else {
          items[existingIndex] = item
        }
      }

      if (!response.data?.length) {
        break
      }

      totalPages = Math.max(page, response.meta?.totalPages ?? 1)
      page += 1
    } while (page <= totalPages)

    return items
  }

  static async findByHandles<T>(
    entityHandle: string,
    handles: EntityHandleValue[],
    {
      filter,
      orderBy,
      relations,
      fields,
      signal,
      pageSize,
      handleField = 'handle',
    }: FindByHandlesOptions = {},
  ): Promise<T[]> {
    const normalizedHandles = [...new Set(handles)]
    if (normalizedHandles.length === 0) {
      return []
    }

    const items: T[] = []
    for (let index = 0; index < normalizedHandles.length; index += GENERIC_API_MAX_PAGE_SIZE) {
      const handleFilter: FilterQuery = {
        [handleField]: {
          $in: normalizedHandles.slice(index, index + GENERIC_API_MAX_PAGE_SIZE),
        },
      }
      const chunkItems = await this.findAll<T>(entityHandle, {
        filter:
          filter && Object.keys(filter).length > 0
            ? { $and: [filter, handleFilter] }
            : handleFilter,
        orderBy,
        relations,
        fields,
        signal,
        pageSize,
      })
      items.push(...chunkItems)
    }

    return items
  }

  static async getTimeline(
    entityHandle: string,
    handle: EntityHandleValue,
    { before, months }: TimelineOptions = {},
  ): Promise<TimelineResponse> {
    const params: Record<string, unknown> = {}

    if (before) {
      params.before = before
    }

    if (typeof months === 'number' && Number.isFinite(months)) {
      params.months = months
    }

    try {
      const response = await axios.get<TimelineResponse>(
        buildApiUrl(`generic/${entityHandle}/${handle}/timeline`),
        { params },
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async getChangeLog(
    entityHandle: string,
    handle: EntityHandleValue,
  ): Promise<ChangeLogEntry[]> {
    try {
      const response = await axios.get<ChangeLogEntry[]>(
        buildApiUrl(`generic/${entityHandle}/${handle}/change-log`),
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async create<T>(entityHandle: string, data: Partial<T>): Promise<T> {
    try {
      const response = await axios.post<T>(buildApiUrl(`generic/${entityHandle}`), data)
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async importRows(
    entityHandle: string,
    rows: Record<string, unknown>[],
  ): Promise<GenericImportResponse> {
    try {
      const response = await axios.post<GenericImportResponse>(
        buildApiUrl(`generic/${entityHandle}/import`),
        { rows },
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async update<T>(
    entityHandle: string,
    handle: EntityHandleValue,
    data: Partial<T>,
    { relations, concurrency, suppressConflictMessage }: UpdateOptions = {},
  ): Promise<T> {
    const params: Record<string, unknown> = {
      handle,
    }
    if (relations && relations.length > 0) {
      params.relations = JSON.stringify(relations)
    }
    if (concurrency?.expectedUpdatedAt) {
      params.expectedUpdatedAt =
        concurrency.expectedUpdatedAt instanceof Date
          ? concurrency.expectedUpdatedAt.toISOString()
          : concurrency.expectedUpdatedAt
    }
    if (concurrency?.merge === true || concurrency?.resolution === 'merge') {
      params.merge = true
    }

    const payload =
      concurrency?.basePayload ||
      concurrency?.resolution ||
      concurrency?.merge === true ||
      concurrency?.force === true
        ? {
            ...data,
            _saplingConcurrency: concurrency,
          }
        : data

    try {
      const response = await axios.patch<T>(buildApiUrl(`generic/${entityHandle}`), payload, {
        params,
      })
      return response.data
    } catch (error: unknown) {
      if (!(suppressConflictMessage && getGenericUpdateConflict(error))) {
        pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      }
      throw error
    }
  }

  static async bulkUpdate(
    entityHandle: string,
    request: GenericBulkUpdateRequest,
  ): Promise<GenericBulkUpdateResponse> {
    try {
      const response = await axios.patch<GenericBulkUpdateResponse>(
        buildApiUrl(`generic/${entityHandle}/bulk`),
        request,
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async getDeleteImpact(
    entityHandle: string,
    handle: EntityHandleValue,
  ): Promise<GenericDeleteImpact> {
    try {
      const response = await axios.get<GenericDeleteImpact>(
        buildApiUrl(`generic/${entityHandle}/delete-impact`),
        { params: { handle } },
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async delete(
    entityHandle: string,
    handle: EntityHandleValue,
    options: GenericDeleteOptions = {},
  ): Promise<GenericDeleteResult> {
    const params: Record<string, unknown> = {
      handle,
    }
    if (options.cascadeRelations?.length) {
      params.cascadeRelations = options.cascadeRelations.join(',')
    }

    try {
      const response = await axios.delete<GenericDeleteResult>(
        buildApiUrl(`generic/${entityHandle}`),
        { params },
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async createReference<T>(
    entityHandle: string,
    referenceName: string,
    entityRecordHandle: EntityHandleValue,
    referenceRecordHandle: EntityHandleValue,
  ): Promise<T> {
    const params: Record<string, unknown> = {
      entityHandle: entityRecordHandle,
      referenceHandle: referenceRecordHandle,
    }

    try {
      const response = await axios.post<T>(
        buildApiUrl(`generic/${entityHandle}/${referenceName}/create`),
        params,
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }

  static async deleteReference<T>(
    entityHandle: string,
    referenceName: string,
    entityRecordHandle: EntityHandleValue,
    referenceRecordHandle: EntityHandleValue,
  ): Promise<T> {
    const params: Record<string, EntityHandleValue> = {
      entityHandle: entityRecordHandle,
      referenceHandle: referenceRecordHandle,
    }

    try {
      const response = await axios.post<T>(
        buildApiUrl(`generic/${entityHandle}/${referenceName}/delete`),
        params,
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', entityHandle)
      throw error
    }
  }
}

function getItemHandle(item: unknown): EntityHandleValue | null {
  if (typeof item !== 'object' || item === null || !('handle' in item)) {
    return null
  }

  const handle = (item as { handle?: unknown }).handle
  return typeof handle === 'string' || typeof handle === 'number' ? handle : null
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

export default ApiGenericService

export function getGenericUpdateConflict(error: unknown): GenericUpdateConflictDetails | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (response?.status !== 409 || typeof response.data !== 'object' || response.data === null) {
    return null
  }

  const details = (response.data as { details?: unknown }).details
  if (typeof details !== 'object' || details === null) {
    return null
  }

  const conflict = details as Partial<GenericUpdateConflictDetails>
  return conflict.reason === 'staleRecord' && Array.isArray(conflict.fields)
    ? (conflict as GenericUpdateConflictDetails)
    : null
}
