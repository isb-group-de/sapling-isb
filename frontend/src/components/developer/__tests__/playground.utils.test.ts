import { describe, expect, it } from 'vitest'
import type { KPIItem } from '@/entity/entity'
import {
  createPlaygroundKpiCards,
  createPlaygroundMetrics,
  getAvailablePlaygroundKpis,
} from '../playground.utils'

describe('Developer playground utilities', () => {
  it('keeps only loaded KPI records in their configured order', () => {
    const first = { handle: 1, name: 'First' } as KPIItem
    const third = { handle: 7, name: 'Third' } as KPIItem

    expect(getAvailablePlaygroundKpis([first, null, third])).toEqual([first, third])
  })

  it('projects KPI values and loading states onto the stable card catalog', () => {
    const first = { handle: 1, name: 'First' } as KPIItem
    const cards = createPlaygroundKpiCards([first, null, null, null], [false, true, false, false])

    expect(cards.map(({ handle, index }) => ({ handle, index }))).toEqual([
      { handle: 1, index: 1 },
      { handle: 3, index: 3 },
      { handle: 7, index: 7 },
      { handle: 9, index: 9 },
    ])
    expect(cards[0]).toMatchObject({ kpi: first, isLoading: false })
    expect(cards[1]).toMatchObject({ kpi: null, isLoading: true })
  })

  it('combines translated labels with current showcase counts', () => {
    expect(
      createPlaygroundMetrics(['Actions', 'Dialogs', 'Templates', 'KPIs'], [8, 5, 12, 4]),
    ).toEqual([
      { label: 'Actions', value: 8 },
      { label: 'Dialogs', value: 5 },
      { label: 'Templates', value: 12 },
      { label: 'KPIs', value: 4 },
    ])
  })
})
