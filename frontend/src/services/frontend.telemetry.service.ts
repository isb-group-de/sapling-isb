import type { App } from 'vue'
import axios from 'axios'
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'
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

type MetricKey = 'web.lcpMs' | 'web.cls' | 'web.inpMs' | 'web.bootMs'

type MetricPayload = {
  metricKey: MetricKey
  value: number
  page: string
}

const reportedErrors = new Set<string>()
const pendingMetrics = new Map<string, MetricPayload>()
let lastRequestId: string | undefined
let lastCorrelationId: string | undefined
let responseInterceptorInstalled = false
let metricFlushTimer: number | undefined
let metricFlushInProgress: Promise<void> | null = null

export function installFrontendTelemetry(app: App): void {
  installResponseInterceptor()
  installVueErrorHandler(app)
  installWindowErrorHandlers()
  reportBootMetric()
  observeWebVitals()
  installMetricFlush()
}

function installResponseInterceptor(): void {
  if (responseInterceptorInstalled) return
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

function installVueErrorHandler(app: App): void {
  const previousHandler = app.config.errorHandler
  app.config.errorHandler = (error, instance, info) => {
    void reportError(error, `vue:${info}`)
    previousHandler?.(error, instance, info)
  }
}

function installWindowErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    void reportError(
      event.error ?? event.message,
      event.filename ? 'window.script' : 'window.asset',
    )
  })
  window.addEventListener('unhandledrejection', (event) => {
    void reportError(event.reason, 'window.unhandledrejection')
  })
}

function installMetricFlush(): void {
  if (metricFlushTimer == null) {
    metricFlushTimer = window.setInterval(() => void flushMetrics(), 10_000)
  }
  const flush = () => void flushMetrics()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
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
  const capture = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined
    if (navigation && navigation.domContentLoadedEventEnd > 0) {
      queueMetric('web.bootMs', navigation.domContentLoadedEventEnd, pageDimension())
    }
  }
  if (document.readyState === 'complete') window.setTimeout(capture, 0)
  else window.addEventListener('load', capture, { once: true })
}

function observeWebVitals(): void {
  const page = pageDimension()
  const report = (metricKey: MetricKey) => (metric: Metric) =>
    queueMetric(metricKey, metric.value, page)
  onLCP(report('web.lcpMs'), { reportAllChanges: false })
  onCLS(report('web.cls'), { reportAllChanges: false })
  onINP(report('web.inpMs'), { reportAllChanges: false })
}

export function queueMetric(metricKey: MetricKey, value: number, page: string): void {
  if (!Number.isFinite(value) || value < 0) return
  const metric = { metricKey, value, page: normalizePageDimension(page) }
  pendingMetrics.set(`${metric.metricKey}:${metric.page}`, metric)
  if (pendingMetrics.size >= 20) void flushMetrics()
}

export function flushMetrics(): Promise<void> {
  if (metricFlushInProgress) return metricFlushInProgress
  if (pendingMetrics.size === 0) return Promise.resolve()
  const metrics = [...pendingMetrics.values()].slice(0, 20)
  for (const metric of metrics) {
    pendingMetrics.delete(`${metric.metricKey}:${metric.page}`)
  }
  metricFlushInProgress = post('client-metrics', { metrics })
    .then((accepted) => {
      if (!accepted)
        metrics.forEach((metric) => queueMetric(metric.metricKey, metric.value, metric.page))
    })
    .finally(() => {
      metricFlushInProgress = null
      if (pendingMetrics.size >= 20) void flushMetrics()
    })
  return metricFlushInProgress
}

async function post(
  endpoint: string,
  payload: ErrorPayload | Record<string, unknown>,
): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl(`system/telemetry/${endpoint}`), {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = (await response.json().catch(() => null)) as { accepted?: boolean } | null
    return response.ok && result?.accepted !== false
  } catch {
    return false
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
  return normalizePageDimension(window.location.pathname)
}

export function normalizePageDimension(path: string): string {
  const segments = path
    .split(/[/?#]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) =>
      /^\d+$/.test(segment) || /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(segment)
        ? ':id'
        : segment.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32),
    )
    .filter(Boolean)
  return (segments.join('/') || 'home').slice(0, 64)
}

function rememberRequestContext(headers: Record<string, unknown>): void {
  const requestId = headers['x-request-id']
  const correlationId = headers['x-correlation-id']
  if (typeof requestId === 'string') lastRequestId = requestId.slice(0, 64)
  if (typeof correlationId === 'string') lastCorrelationId = correlationId.slice(0, 64)
}
