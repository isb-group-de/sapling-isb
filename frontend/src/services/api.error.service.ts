import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useAuthStore } from '@/stores/authStore'

export interface ApiErrorPayload {
  message: string
  description: string
  technical?: unknown
  descriptionParams?: Record<string, unknown>
}

const messageCenter = useSaplingMessageCenter()
const HTTP_STATUS_EXCEPTION_KEYS: Record<number, string> = {
  400: 'exception.badRequest',
  401: 'exception.unauthorized',
  403: 'exception.forbidden',
  404: 'exception.notFound',
  409: 'exception.conflict',
  413: 'exception.payloadTooLarge',
  429: 'exception.tooManyRequests',
}

export function resolveApiError(
  error: unknown,
  fallbackMessage = 'exception.unknownError',
): ApiErrorPayload {
  let message = fallbackMessage
  let description = ''
  let technical: unknown
  let descriptionParams: Record<string, unknown> | undefined

  if (typeof error === 'object' && error !== null) {
    const err = error as {
      response?: {
        status?: number
        statusText?: string
        data?:
          | {
              message?: string | string[]
              error?: string
              requestId?: string
              path?: string
              method?: string
              timestamp?: string
              details?:
                | {
                    summary?: string
                    summaryKey?: string
                    summaryParams?: Record<string, unknown>
                    referencingEntityHandle?: string
                  }
                | unknown
              technical?: unknown
            }
          | string
      }
      code?: string
      message?: string
      config?: { method?: string; url?: string; params?: unknown; data?: unknown }
    }
    const status = err.response?.status
    const responseData = err.response?.data
    const responseMessage =
      typeof responseData === 'object' && responseData !== null
        ? Array.isArray(responseData.message)
          ? responseData.message.join(', ')
          : responseData.message
        : typeof responseData === 'string'
          ? responseData
          : ''
    const responseError =
      typeof responseData === 'object' && responseData !== null ? responseData.error : ''
    const responseDetails =
      typeof responseData === 'object' && responseData !== null ? responseData.details : null
    const responseSummary =
      typeof responseDetails === 'object' &&
      responseDetails !== null &&
      'summary' in responseDetails &&
      typeof responseDetails.summary === 'string'
        ? responseDetails.summary
        : ''
    const responseSummaryKey =
      typeof responseDetails === 'object' &&
      responseDetails !== null &&
      'summaryKey' in responseDetails &&
      typeof responseDetails.summaryKey === 'string'
        ? responseDetails.summaryKey
        : ''
    const responseSummaryParams =
      typeof responseDetails === 'object' &&
      responseDetails !== null &&
      'summaryParams' in responseDetails &&
      isRecord(responseDetails.summaryParams)
        ? responseDetails.summaryParams
        : undefined
    const referencingEntityHandle =
      typeof responseDetails === 'object' &&
      responseDetails !== null &&
      'referencingEntityHandle' in responseDetails &&
      typeof responseDetails.referencingEntityHandle === 'string'
        ? responseDetails.referencingEntityHandle
        : undefined

    if (responseMessage?.startsWith('exception.')) {
      message = responseMessage
    } else if (responseMessage?.startsWith('global.')) {
      message = responseMessage
    } else if (responseMessage) {
      message = responseMessage
    } else if (typeof status === 'number' && HTTP_STATUS_EXCEPTION_KEYS[status]) {
      message = HTTP_STATUS_EXCEPTION_KEYS[status]
    } else if (err.code === 'ERR_NETWORK') {
      message = 'exception.connectionException'
    } else if (typeof status === 'number' && status >= 500) {
      message = 'exception.serverException'
    }

    description = responseSummaryKey || responseSummary || normalizeResponseError(responseError)
    descriptionParams =
      responseSummaryParams ??
      (referencingEntityHandle ? { entityHandle: referencingEntityHandle } : undefined)
    technical = {
      client: {
        code: err.code,
        message: err.message,
        method: err.config?.method,
        url: err.config?.url,
        params: err.config?.params,
        data: redactPayload(err.config?.data),
      },
      response: {
        status,
        statusText: err.response?.statusText,
        data: responseData,
      },
    }
  }

  return { message, description, technical, descriptionParams }
}

export function pushApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
  context: string,
): void {
  const { message, description, technical, descriptionParams } = resolveApiError(
    error,
    fallbackMessage,
  )
  if (message === 'exception.unauthorized') {
    useAuthStore().clear()
  }
  messageCenter.pushMessage('error', message, description, context, technical, descriptionParams)
}

function normalizeResponseError(responseError: string | undefined): string {
  if (
    !responseError ||
    /^(bad request|unauthorized|forbidden|not found|conflict|internal server error)$/i.test(
      responseError.trim(),
    )
  ) {
    return ''
  }

  return responseError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function redactPayload(payload: unknown): unknown {
  if (typeof payload === 'string') {
    try {
      return redactPayload(JSON.parse(payload))
    } catch {
      return payload
    }
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactPayload(item))
  }

  if (typeof payload !== 'object' || payload === null) {
    return payload
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      /password|secret|token|authorization|cookie/i.test(key) ? '[redacted]' : redactPayload(value),
    ]),
  )
}
