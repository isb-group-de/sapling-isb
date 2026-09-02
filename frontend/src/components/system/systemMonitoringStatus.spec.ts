import { describe, expect, it } from 'vitest'
import { maximumActiveCollectorGapSeconds } from './systemMonitoringStatus'

describe('system monitoring collector status', () => {
  it('ignores gaps from stopped and retired collector instances', () => {
    expect(
      maximumActiveCollectorGapSeconds({
        instances: [
          { status: 'active', enabled: true, gapSeconds: 8.5 },
          { status: 'stopped', enabled: false, gapSeconds: 56_128.5 },
          { status: 'retired', enabled: false, gapSeconds: 86_400 },
        ],
      }),
    ).toBe(8.5)
  })

  it('returns zero when no active collector exists', () => {
    expect(
      maximumActiveCollectorGapSeconds({
        instances: [{ status: 'stopped', enabled: false, gapSeconds: 120 }],
      }),
    ).toBe(0)
  })
})
