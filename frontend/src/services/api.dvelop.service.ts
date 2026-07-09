import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export interface DvelopImportedObjectDefinition {
  dvelopId: string
  title: string
  description?: string | null
  isActive?: boolean
  rawPayload?: Record<string, unknown> | null
}

export interface DvelopImportedRepository {
  dvelopId: string
  title: string
  version?: string | null
  isDefault?: boolean
  isAvailable?: boolean
  rawPayload?: Record<string, unknown> | null
}

export interface DvelopImportedProperty {
  dvelopId: string
  objectDefinitionId?: string | null
  title: string
  dataType?: string | null
  description?: string | null
  isRequired?: boolean
  isMultiValue?: boolean
  isActive?: boolean
  rawPayload?: Record<string, unknown> | null
}

export interface DvelopConfigurationImportPayload {
  repositories?: DvelopImportedRepository[]
  objectDefinitions?: DvelopImportedObjectDefinition[]
  properties?: DvelopImportedProperty[]
}

export interface DvelopConfigurationSyncPayload {
  repositories?: boolean
  objectDefinitions?: boolean
  properties?: boolean
}

export interface DvelopConfigurationImportSummary {
  total: number
  created: number
  updated: number
  skipped: number
}

export interface DvelopConfigurationImportResponse {
  repositories: DvelopConfigurationImportSummary
  objectDefinitions: DvelopConfigurationImportSummary
  properties: DvelopConfigurationImportSummary
}

export type DvelopHealthCheckStatus = 'success' | 'warning' | 'error'

export type DvelopHealthCheckCapabilityKey =
  | 'apiKey'
  | 'repositories'
  | 'objectDefinitions'
  | 'properties'

export interface DvelopHealthCheckCapability {
  key: DvelopHealthCheckCapabilityKey
  status: DvelopHealthCheckStatus
  message: string
  count?: number
}

export interface DvelopHealthCheckResponse {
  status: DvelopHealthCheckStatus
  checkedAt: string
  connectionHandle: number
  repositoryId?: string | null
  capabilities: DvelopHealthCheckCapability[]
}

class ApiDvelopService {
  static async importConfiguration(
    connectionHandle: number,
    payload: DvelopConfigurationImportPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    try {
      const response = await axios.post<DvelopConfigurationImportResponse>(
        buildApiUrl(`document/dvelop/config/${connectionHandle}/import`),
        payload,
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', 'dvelopCloud')
      throw error
    }
  }

  static async syncConfiguration(
    connectionHandle: number,
    payload: DvelopConfigurationSyncPayload,
  ): Promise<DvelopConfigurationImportResponse> {
    try {
      const response = await axios.post<DvelopConfigurationImportResponse>(
        buildApiUrl(`document/dvelop/config/${connectionHandle}/sync`),
        payload,
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', 'dvelopCloud')
      throw error
    }
  }

  static async healthCheckConfiguration(
    connectionHandle: number,
  ): Promise<DvelopHealthCheckResponse> {
    try {
      const response = await axios.post<DvelopHealthCheckResponse>(
        buildApiUrl(`document/dvelop/config/${connectionHandle}/health`),
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', 'dvelopCloud')
      throw error
    }
  }
}

export default ApiDvelopService
