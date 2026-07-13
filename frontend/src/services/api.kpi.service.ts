import axios from 'axios'
import type { KpiResponse } from '@/entity/structure'
import { buildApiUrl } from '@/services/api.client'
import { pushApiErrorMessage } from '@/services/api.error.service'

type PendingKpiRequest<T> = {
  handle: string | number
  resolve: (value: KpiResponse<T>) => void
  reject: (reason?: unknown) => void
}

class ApiKpiService {
  private static pendingRequests: PendingKpiRequest<unknown>[] = []
  private static pendingFlush: ReturnType<typeof setTimeout> | null = null

  static async execute<T>(handle: string | number): Promise<KpiResponse<T>> {
    return new Promise<KpiResponse<T>>((resolve, reject) => {
      ApiKpiService.pendingRequests.push({
        handle,
        resolve: resolve as (value: KpiResponse<unknown>) => void,
        reject,
      })
      ApiKpiService.scheduleFlush()
    })
  }

  private static scheduleFlush(): void {
    if (ApiKpiService.pendingFlush) {
      return
    }

    ApiKpiService.pendingFlush = setTimeout(() => {
      ApiKpiService.pendingFlush = null
      void ApiKpiService.flushPendingRequests()
    }, 0)
  }

  private static async flushPendingRequests(): Promise<void> {
    const requests = ApiKpiService.pendingRequests.splice(0)

    if (requests.length === 0) {
      return
    }

    if (requests.length === 1) {
      await ApiKpiService.executeSingle(requests[0])
      return
    }

    const endpoint = 'kpi/execute-batch'
    const handles = [...new Set(requests.map((request) => request.handle))]

    try {
      const response = await axios.post<{ items: KpiResponse<unknown>[] }>(buildApiUrl(endpoint), {
        handles,
      })
      const responsesByHandle = new Map(
        (response.data.items ?? [])
          .map((item) => [item.kpi?.handle == null ? null : String(item.kpi.handle), item] as const)
          .filter(([responseHandle]) => responseHandle != null),
      )

      requests.forEach((request) => {
        const result = responsesByHandle.get(String(request.handle)) ?? null
        if (result) {
          request.resolve(result)
          return
        }

        request.reject(new Error('KPI response missing from batch result'))
      })
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', endpoint)
      requests.forEach((request) => request.reject(error))
    }
  }

  private static async executeSingle<T>(request: PendingKpiRequest<T>): Promise<void> {
    const endpoint = `kpi/execute/${request.handle}`

    try {
      const response = await axios.get<KpiResponse<T>>(buildApiUrl(endpoint))
      request.resolve(response.data)
    } catch (error: unknown) {
      pushApiErrorMessage(error, 'exception.unknownError', endpoint)
      request.reject(error)
    }
  }
}

export default ApiKpiService
