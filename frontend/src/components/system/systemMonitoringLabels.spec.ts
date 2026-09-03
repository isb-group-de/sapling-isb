import { describe, expect, it } from 'vitest'
import {
  MONITORING_METRIC_DEFINITIONS,
  monitoringCheckLabel,
  monitoringIncidentText,
  monitoringIncidentTypeLabel,
  monitoringMetricLabel,
  monitoringMetricValue,
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
    expect(monitoringCheckLabel('de-DE', 'telemetry.configuration')).toBe(
      'Telemetrie-Konfiguration',
    )
    expect(monitoringStateLabel('de-DE', 'unknown')).toBe('Keine Daten')
  })

  it('formats incident values in the native metric unit', () => {
    expect(monitoringMetricValue('de-DE', 'http.p95Ms', 3000)).toBe('3.000 ms')
    expect(monitoringMetricValue('de-DE', 'host.cpu.percent', 92.45)).toBe('92,5 %')
    expect(monitoringMetricValue('en-US', 'process.memory.rssBytes', 1048576)).toBe('1 MB')
  })

  it('provides localized incident terminology when translations are not loaded yet', () => {
    expect(monitoringIncidentTypeLabel('de-DE', 'threshold')).toBe('Schwellenwertalarm')
    expect(monitoringIncidentTypeLabel('en-US', 'collectorGap')).toBe('Collector gap')
    expect(monitoringIncidentText((key) => key, 'de-DE', 'samples')).toBe('Ausgewertete Messpunkte')
  })
})
