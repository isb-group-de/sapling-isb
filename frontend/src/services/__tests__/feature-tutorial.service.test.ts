import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumePendingSaplingFeatureTutorial,
  SAPLING_START_FEATURE_TUTORIAL_EVENT,
  startSaplingFeatureTutorial,
} from '@/services/feature-tutorial.service'

describe('feature tutorial service', () => {
  beforeEach(() => {
    for (const tutorial of ['table', 'partner', 'calendar'] as const) {
      consumePendingSaplingFeatureTutorial(tutorial)
    }
  })

  it('dispatches the requested tutorial and keeps it pending for route changes', () => {
    const listener = vi.fn()
    window.addEventListener(SAPLING_START_FEATURE_TUTORIAL_EVENT, listener)

    startSaplingFeatureTutorial('calendar')

    expect(listener).toHaveBeenCalledOnce()
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toBe('calendar')
    expect(consumePendingSaplingFeatureTutorial('calendar')).toBe(true)
    expect(consumePendingSaplingFeatureTutorial('calendar')).toBe(false)

    window.removeEventListener(SAPLING_START_FEATURE_TUTORIAL_EVENT, listener)
  })

  it('keeps different feature tutorials independent', () => {
    startSaplingFeatureTutorial('table')

    expect(consumePendingSaplingFeatureTutorial('partner')).toBe(false)
    expect(consumePendingSaplingFeatureTutorial('table')).toBe(true)
  })
})
