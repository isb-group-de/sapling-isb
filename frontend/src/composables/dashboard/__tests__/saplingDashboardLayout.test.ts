import { describe, expect, it } from 'vitest'
import { restoreDashboardLayoutSnapshot } from '../saplingDashboardLayout'

describe('restoreDashboardLayoutSnapshot', () => {
  it('restores ordering without resurrecting persisted dashboard or KPI removals', () => {
    const snapshot = [
      { handle: 1, name: 'One', kpis: [{ handle: 10 }, { handle: 11 }] },
      { handle: 2, name: 'Two', kpis: [{ handle: 20 }] },
      { handle: 3, name: 'Three', kpis: [{ handle: 30 }] },
    ]
    const current = [
      { handle: 3, name: 'Three', kpis: [{ handle: 30 }] },
      { handle: 1, name: 'One', kpis: [{ handle: 11 }] },
    ]

    const restored = restoreDashboardLayoutSnapshot(snapshot as never, current as never)

    expect(restored.map((dashboard) => dashboard.handle)).toEqual([1, 3])
    expect(restored[0].kpis?.map((kpi) => kpi.handle)).toEqual([11])
    expect(restored[0].kpiOrder).toEqual([11])
  })
})
