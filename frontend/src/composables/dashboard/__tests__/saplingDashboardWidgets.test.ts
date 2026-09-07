import { describe, expect, it } from 'vitest'
import { getDashboardWidgets } from '../saplingDashboardWidgets'
import type { DashboardItem } from '@/entity/entity'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'

describe('dashboard widget persistence', () => {
  it('converts legacy KPI order, calendar definitions and half-height values', () => {
    const widgets = getDashboardWidgets({
      kpiOrder: [2, 1],
      kpis: [
        { handle: 1, name: 'Count', type: 'ITEM' },
        {
          handle: 2,
          name: 'Agenda',
          type: { handle: 'CALENDAR' },
          filter: { status: 'confirmed' },
        },
      ] as DashboardItem['kpis'],
    })
    expect(widgets.map((widget) => [widget.id, widget.kind, widget.rows])).toEqual([
      ['kpi-2', 'AGENDA', 2],
      ['kpi-1', 'KPI', 1],
    ])
    expect(widgets[0]?.config).toEqual({ filter: { status: 'confirmed' }, days: 90, limit: 5 })
  })
  it('keeps all kinds, ordering, size and nested settings when copying a template', () => {
    const widgets: DashboardWidget[] = [
      {
        id: 'web',
        kind: 'WEBSITE',
        title: 'Website',
        columns: 2,
        rows: 4,
        config: { url: 'https://example.com', mode: 'embed' },
      },
      {
        id: 'table',
        kind: 'TABLE',
        title: 'Tickets',
        columns: 2,
        rows: 4,
        config: {
          entity: 'ticket',
          filter: { status: 'open' },
          columns: ['title'],
          sortBy: [{ key: 'title', order: 'asc' }],
          search: 'test',
          pageSize: 20,
        },
      },
    ]
    const copied = getDashboardWidgets({ widgets })
    expect(copied).toEqual(widgets)
    if (copied[1]?.kind === 'TABLE') copied[1].config.columns.push('status')
    expect(widgets[1]?.config).toMatchObject({ columns: ['title'] })
    expect(
      getDashboardWidgets({ widgets: [], kpis: [{ handle: 1 }] as DashboardItem['kpis'] }),
    ).toEqual([])
  })
})
