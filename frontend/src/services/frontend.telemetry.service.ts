import type { App } from 'vue'
import axios from 'axios'
import { buildApiUrl } from '@/services/api.client'

type ErrorPayload = {
  operation: string
  errorClass: string
  errorCode?: string
  message: string
  stack?: string
  requestId?: string
  correlationId?: string
}

const reportedErrors = new Set<string>()
let lastRequestId: string | undefined
let lastCorrelationId: string | undefined
let responseInterceptorInstalled = false

export function installFrontendTelemetry(app: App): void {
  if (!responseInterceptorInstalled) {
    axios.interceptors.response.use(
      (response) => {
        rememberRequestContext(response.headers)
        return response
      },
      (error: unknown) => {
        if (axios.isAxiosError(error) && error.response) {
          rememberRequestContext(error.response.headers)
        }
        return Promise.reject(error)
      },
    )
    responseInterceptorInstalled = true
  }
  const previousHandler = app.config.errorHandler
  app.config.errorHandler = (error, instance, info) => {
    void reportError(error, `vue:${info}`)
    previousHandler?.(error, instance, info)
  }

  window.addEventListener('error', (event) => {
    void reportError(
      event.error ?? event.message,
      event.filename ? 'window.script' : 'window.asset',
    )
  })
  window.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason, 'window.unhandledrejection')
  })
  reportBootMetric()
  observeWebVitals()
}

async function reportError(error: unknown, operation: string): Promise<void> {
  const normalized = normalizeError(error)
  const fingerprint = `${operation}:${normalized.errorClass}:${normalized.message}:${normalized.stack?.split('\n')[0] ?? ''}`
  if (reportedErrors.has(fingerprint)) return
  reportedErrors.add(fingerprint)
  if (reportedErrors.size > 100) reportedErrors.delete(reportedErrors.values().next().value ?? '')
  await post('client-error', {
    ...normalized,
    operation,
    requestId: lastRequestId,
    correlationId: lastCorrelationId,
  })
}

function reportBootMetric(): void {
  const navigation = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined
  if (navigation)
    void reportMetric('web.bootMs', navigation.domContentLoadedEventEnd, pageDimension())
}

function observeWebVitals(): void {
  if (!('PerformanceObserver' in window)) return
  observe('largest-contentful-paint', (entry) =>
    reportMetric('web.lcpMs', entry.startTime, pageDimension()),
  )
  observe('layout-shift', (entry) => {
    const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
    if (!shift.hadRecentInput) void reportMetric('web.cls', shift.value ?? 0, pageDimension())
  })
  observe('event', (entry) => {
    const interaction = entry as PerformanceEntry & { duration?: number; interactionId?: number }
    if (interaction.interactionId)
      void reportMetric('web.inpMs', interaction.duration ?? 0, pageDimension())
  })
}

function observe(type: string, callback: (entry: PerformanceEntry) => void): void {
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback))
    observer.observe({ type, buffered: true })
  } catch {
    // The browser does not support this entry type.
  }
}

async function reportMetric(metricKey: string, value: number, page: string): Promise<void> {
  if (!Number.isFinite(value) || value < 0) return
  await post('client-metric', { metricKey, value, page })
}

async function post(
  endpoint: string,
  payload: ErrorPayload | Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(buildApiUrl(`system/telemetry/${endpoint}`), {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Telemetry must never disturb the user flow.
  }
}

function normalizeError(error: unknown): ErrorPayload {
  if (error instanceof Error) {
    return {
      operation: 'frontend',
      errorClass: error.name || 'Error',
      message: redact(error.message),
      stack: error.stack ? redact(error.stack).slice(0, 8000) : undefined,
    }
  }
  return { operation: 'frontend', errorClass: 'Error', message: redact(String(error)) }
}

function redact(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b\d{4,}\b/g, '[id]')
    .replace(/(?:bearer\s+)?[a-z0-9_-]{24,}/gi, '[redacted]')
    .slice(0, 8000)
}

function pageDimension(): string {
  const segment = window.location.pathname.split('/').filter(Boolean)[0]
  return (segment || 'home').slice(0, 64)
}

function rememberRequestContext(headers: Record<string, unknown>): void {
  const requestId = headers['x-request-id']
  const correlationId = headers['x-correlation-id']
  if (typeof requestId === 'string') lastRequestId = requestId.slice(0, 64)
  if (typeof correlationId === 'string') lastCorrelationId = correlationId.slice(0, 64)
}
