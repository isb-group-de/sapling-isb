import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

export type CalendarSyncProvider = 'azure' | 'google'

export interface CalendarImportPayload {
  startDateTime: string
  endDateTime: string
}

export interface CalendarImportResult {
  imported: number
  created: number
  updated: number
  skipped: number
}

export interface MaterializeEventRecurrencePayload {
  expectedUpdatedAt?: string
}

export interface MaterializeEventRecurrenceResult {
  materializedCount: number
  handles: Array<string | number>
}

class ApiCalendarService {
  static async importEvents(
    provider: CalendarSyncProvider,
    payload: CalendarImportPayload,
  ): Promise<CalendarImportResult> {
    const endpoint = `${provider}/events/import`

    try {
      const response = await axios.post<CalendarImportResult>(buildApiUrl(endpoint), payload)
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', endpoint)
      throw error
    }
  }

  static async materializeEventRecurrence(
    handle: string | number,
    payload: MaterializeEventRecurrencePayload = {},
  ): Promise<MaterializeEventRecurrenceResult> {
    const endpoint = `calendar/events/${encodeURIComponent(String(handle))}/materialize-recurrence`

    try {
      const response = await axios.post<MaterializeEventRecurrenceResult>(
        buildApiUrl(endpoint),
        payload,
      )
      return response.data
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', endpoint)
      throw error
    }
  }
}

export default ApiCalendarService
