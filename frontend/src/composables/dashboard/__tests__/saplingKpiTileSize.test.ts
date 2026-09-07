import { describe, expect, it } from 'vitest'
import type { KPIItem } from '@/entity/entity'
import { getKpiTileRows } from '../saplingKpiTileSize'

describe('KPI tile size', () => {
  it('uses a half-height row for both scalar and populated value KPI type references', () => {
    expect(getKpiTileRows({ type: 'ITEM' } as KPIItem)).toBe(1)
    expect(getKpiTileRows({ type: { handle: 'ITEM' } } as KPIItem)).toBe(1)
  })

  it('reserves a square for other types and definitions that are still loading', () => {
    for (const type of ['CALENDAR', 'LIST', 'TREND', 'FORMULA', 'TARGET', 'CUSTOM']) {
      expect(getKpiTileRows({ type } as KPIItem)).toBe(2)
    }
    expect(getKpiTileRows(null)).toBe(2)
    expect(getKpiTileRows(undefined)).toBe(2)
  })
})
