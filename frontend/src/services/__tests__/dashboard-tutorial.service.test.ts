import { describe, expect, it, vi } from 'vitest'
import {
  SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT,
  SAPLING_START_DASHBOARD_TUTORIAL_EVENT,
  setSaplingDashboardTutorialLayout,
  startSaplingDashboardTutorial,
} from '@/services/dashboard-tutorial.service'

describe('dashboard tutorial service', () => {
  it('dispatches a restart request', () => {
    const listener = vi.fn()
    window.addEventListener(SAPLING_START_DASHBOARD_TUTORIAL_EVENT, listener)

    startSaplingDashboardTutorial()

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(SAPLING_START_DASHBOARD_TUTORIAL_EVENT, listener)
  })

  it('dispatches the requested layout mode', () => {
    const details: boolean[] = []
    const listener = (event: Event) => {
      details.push((event as CustomEvent<boolean>).detail)
    }
    window.addEventListener(SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT, listener)

    setSaplingDashboardTutorialLayout(true)
    setSaplingDashboardTutorialLayout(false)

    expect(details).toEqual([true, false])
    window.removeEventListener(SAPLING_SET_DASHBOARD_TUTORIAL_LAYOUT_EVENT, listener)
  })
})
