import type { SaplingGenericItem } from '@/entity/entity'
import type {
  DvelopHealthCheckCapabilityKey,
  DvelopHealthCheckStatus,
} from '@/services/api.dvelop.service'

export interface DvelopConnectionItem extends SaplingGenericItem {
  handle: number
  title: string
  baseUrl: string
  repository?: DvelopRepositoryItem | number | string | null
  isActive: boolean
}

export interface DvelopRepositoryItem extends SaplingGenericItem {
  handle?: number | null
  title: string
  dvelopId: string
  lastSyncedAt?: string | Date | null
}

export interface DvelopObjectDefinitionItem extends SaplingGenericItem {
  handle?: number | null
  title: string
  dvelopId: string
  lastSyncedAt?: string | Date | null
}

export interface DvelopPropertyItem extends SaplingGenericItem {
  handle?: number | null
  title: string
  dvelopId: string
  objectDefinition?: SaplingGenericItem | string | number | null
  dataType?: string | null
  lastSyncedAt?: string | Date | null
}

export interface DvelopHealthCapabilityRow {
  key: DvelopHealthCheckCapabilityKey
  status?: DvelopHealthCheckStatus
  count?: number
}
