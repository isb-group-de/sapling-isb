import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KPIItem } from '@/entity/entity'
import { useSaplingKpiCard } from '../useSaplingKpiCard'

const mocks = vi.hoisted(() => ({
  router: {},
  pushAppRoute: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'kpi.typeCalendar' ? 'Kalender-Agenda' : key),
  }),
}))

vi.mock('@/utils/routerNavigation', () => ({
  pushAppRoute: (...args: unknown[]) => mocks.pushAppRoute(...args),
}))

function calendarKpi(targetEntity: KPIItem['targetEntity'] = 'event'): KPIItem {
  return {
    handle: 7,
    name: 'Meine Termine',
    aggregation: { handle: 'COUNT' },
    field: 'handle',
    type: 'CALENDAR',
    targetEntity,
    createdAt: null,
  }
}

describe('useSaplingKpiCard calendar behavior', () => {
  beforeEach(() => {
    mocks.pushAppRoute.mockClear()
  })

  it('recognizes the calendar KPI and opens the full calendar route', async () => {
    const state = useSaplingKpiCard({ kpi: calendarKpi(), kpiIdx: 0 })

    expect(state.isCalendarKpi.value).toBe(true)
    expect(state.kpiTypeLabel.value).toBe('Kalender-Agenda')
    expect(state.canOpenEntity.value).toBe(true)

    await state.openEntity()
    expect(mocks.pushAppRoute).toHaveBeenCalledWith(mocks.router, '/event')
  })

  it('rejects a calendar KPI configured for a non-event entity', async () => {
    const state = useSaplingKpiCard({ kpi: calendarKpi('ticket'), kpiIdx: 0 })

    expect(state.canOpenEntity.value).toBe(false)
    await state.openEntity()
    expect(mocks.pushAppRoute).not.toHaveBeenCalled()
  })

  it('uses the public refresh contract when the widget exposes it', async () => {
    const refresh = vi.fn()
    const state = useSaplingKpiCard({ kpi: calendarKpi(), kpiIdx: 0 })

    state.setRef({ refresh } as never)
    await state.refreshKpi()

    expect(refresh).toHaveBeenCalledOnce()
  })
})
