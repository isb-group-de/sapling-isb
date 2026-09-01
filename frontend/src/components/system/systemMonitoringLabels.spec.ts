import { describe, expect, it } from 'vitest'
import {
  MONITORING_METRIC_DEFINITIONS,
  monitoringCheckLabel,
  monitoringMetricLabel,
  monitoringServiceLabel,
  monitoringStateLabel,
} from './systemMonitoringLabels'

describe('system monitoring metric labels', () => {
  it('provides German and English labels for every registered metric', () => {
    for (const [metricKey, definition] of Object.entries(MONITORING_METRIC_DEFINITIONS)) {
      expect(monitoringMetricLabel((key) => key, 'de-DE', metricKey)).toBe(definition.de)
      expect(monitoringMetricLabel((key) => key, 'en-US', metricKey)).toBe(definition.en)
    }
  })

  it('uses translated values and humanizes unknown metric keys', () => {
    expect(monitoringMetricLabel(() => 'Übersetzt', 'de-DE', 'host.cpu.percent')).toBe('Übersetzt')
    expect(monitoringMetricLabel((key) => key, 'de-DE', 'custom.metricValue')).toBe(
      'Custom metric Value',
    )
    expect(monitoringMetricLabel(() => '', 'de-DE', 'host.cpu.percent')).toBe('CPU-Auslastung')
  })

  it('normalizes legacy metric keys before displaying them', () => {
    expect(monitoringMetricLabel((key) => key, 'de-DE', 'host.memory.used.percent')).toBe(
      'Arbeitsspeicherauslastung',
    )
  })

  it('localizes service, check, and state identifiers', () => {
    expect(monitoringServiceLabel('de-DE', 'database')).toBe('Datenbank')
    expect(monitoringCheckLabel('de-DE', 'frontend.experience')).toBe('Frontend-Erlebnis')
    expect(monitoringStateLabel('de-DE', 'healthy')).toBe('Fehlerfrei')
  })
})
