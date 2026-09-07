import type { KPIItem } from '@/entity/entity'

/** Two half-height rows plus their gap form one square KPI tile. */
export function getKpiTileRows(kpi: KPIItem | null | undefined): 1 | 2 {
  const type = typeof kpi?.type === 'string' ? kpi.type : kpi?.type?.handle
  return type === 'ITEM' ? 1 : 2
}
