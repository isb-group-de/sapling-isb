import axios from 'axios'

import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export type Customer360Anchor = 'company' | 'person'
export type Customer360Section =
  | 'contacts'
  | 'tickets'
  | 'opportunities'
  | 'effortEstimates'
  | 'contracts'
  | 'documents'
  | 'relationships'
export type Customer360ActivityKind =
  'emailInbound' | 'emailOutbound' | 'call' | 'appointment' | 'event'

export interface Customer360ActivityItem {
  id: string
  kind: Customer360ActivityKind
  direction: 'inbound' | 'outbound' | 'none'
  occurredAt: string
  entityHandle: string
  recordHandle: string | number
  title: string
  summary?: string | null
  participants: string[]
  status?: unknown
  attachmentHandles: number[]
  source?: { entityHandle: string; recordHandle: string | number } | null
}

export interface Customer360Summary {
  anchor: Record<string, unknown>
  anchorEntityHandle: Customer360Anchor
  companyContext: Record<string, unknown> | null
  metrics: {
    lastContactAt: string | null
    nextAppointmentAt?: string | null
    openTickets?: number
    slaCriticalTickets?: number
    openOpportunities?: number
    weightedPipeline?: number
    activeEffortEstimates?: number
    estimatedHours?: number
    activeContracts?: number
    nextContractEndAt?: string | null
  }
  warnings: Array<{ key: string; severity: 'info' | 'warning' | 'error'; value?: unknown }>
  recentActivity: Customer360ActivityItem[]
  availableSections: Customer360Section[]
  actions: {
    mail: boolean
    call: boolean
    appointment: boolean
    ticket: boolean
    opportunity: boolean
    effortEstimate: boolean
    contract: boolean
  }
}

export interface Customer360ActivityResult {
  items: Customer360ActivityItem[]
  nextBefore: string | null
  hasMore: boolean
}

export interface Customer360RelatedResult {
  section: Customer360Section
  entityHandle: string
  data: Array<Record<string, unknown>>
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export default class ApiCustomer360Service {
  static async getSummary(anchor: Customer360Anchor, handle: string | number) {
    return this.get<Customer360Summary>(`${anchor}/${handle}/summary`)
  }

  static async getActivity(
    anchor: Customer360Anchor,
    handle: string | number,
    options: {
      before?: string
      after?: string
      limit?: number
      kinds?: Customer360ActivityKind[]
      direction?: 'inbound' | 'outbound' | 'none'
    } = {},
  ) {
    return this.get<Customer360ActivityResult>(`${anchor}/${handle}/activity`, {
      before: options.before,
      after: options.after,
      limit: options.limit ?? 30,
      kinds: options.kinds?.join(','),
      direction: options.direction,
    })
  }

  static async getRelated(
    anchor: Customer360Anchor,
    handle: string | number,
    section: Customer360Section,
    page = 1,
    limit = 20,
    filter?: Record<string, unknown>,
  ) {
    return this.get<Customer360RelatedResult>(`${anchor}/${handle}/related/${section}`, {
      page,
      limit,
      filter: filter && Object.keys(filter).length > 0 ? JSON.stringify(filter) : undefined,
    })
  }

  private static async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await axios.get<T>(buildApiUrl(`customer-360/${path}`), { params })
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', 'customer360')
      throw error
    }
  }
}
