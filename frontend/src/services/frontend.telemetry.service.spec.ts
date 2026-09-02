import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushMetrics, normalizePageDimension, queueMetric } from './frontend.telemetry.service'

vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
}))

vi.mock('@/services/api.client', () => ({
  buildApiUrl: (path: string) => `/api/${path}`,
}))

describe('frontend telemetry', () => {
  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ accepted: true }) }),
    )
    await flushMetrics()
  })

  it('normalizes two page segments without retaining record identifiers', () => {
    expect(normalizePageDimension('/partner/12345/details')).toBe('partner/:id')
    expect(normalizePageDimension('/event/550e8400-e29b-41d4-a716-446655440000')).toBe('event/:id')
    expect(normalizePageDimension('/')).toBe('home')
  })

  it('deduplicates metrics per key and page into one batch request', async () => {
    queueMetric('web.lcpMs', 1200, '/table/person')
    queueMetric('web.lcpMs', 900, '/table/person')
    queueMetric('web.cls', 0.02, '/table/person')

    await flushMetrics()

    expect(fetch).toHaveBeenCalledTimes(1)
    const request = vi.mocked(fetch).mock.calls[0]
    expect(request?.[0]).toBe('/api/system/telemetry/client-metrics')
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      metrics: [
        { metricKey: 'web.lcpMs', value: 900, page: 'table/person' },
        { metricKey: 'web.cls', value: 0.02, page: 'table/person' },
      ],
    })
  })
})
