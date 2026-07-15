import type { KPIItem } from '@/entity/entity'
import type { PlaygroundKpiCard, PlaygroundMetric } from './playground.types'

export const PLAYGROUND_KPI_CONFIG = [
  { handle: 1, index: 1 },
  { handle: 3, index: 3 },
  { handle: 7, index: 7 },
  { handle: 9, index: 9 },
] as const

export function getAvailablePlaygroundKpis(kpis: Array<KPIItem | null>): KPIItem[] {
  return kpis.filter((kpi): kpi is KPIItem => kpi != null)
}

export function createPlaygroundKpiCards(
  kpis: Array<KPIItem | null>,
  loadingStates: boolean[],
): PlaygroundKpiCard[] {
  return PLAYGROUND_KPI_CONFIG.map((config, index) => ({
    ...config,
    kpi: kpis[index] ?? null,
    isLoading: loadingStates[index] ?? true,
  }))
}

export function createPlaygroundMetrics(
  labels: [string, string, string, string],
  values: [number, number, number, number],
): PlaygroundMetric[] {
  return labels.map((label, index) => ({ label, value: values[index] }))
}
