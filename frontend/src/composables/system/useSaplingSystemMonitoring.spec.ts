import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from './useSaplingSystemMonitoring'

describe('system monitoring request scheduling', () => {
  it('limits concurrent detail requests', async () => {
    let active = 0
    let maximumActive = 0
    const completed: number[] = []
    const tasks = [0, 1, 2, 3, 4].map((value) => async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await Promise.resolve()
      completed.push(value)
      active -= 1
    })

    await runWithConcurrency(tasks, 2)

    expect(maximumActive).toBe(2)
    expect(completed).toEqual([0, 1, 2, 3, 4])
  })
})
