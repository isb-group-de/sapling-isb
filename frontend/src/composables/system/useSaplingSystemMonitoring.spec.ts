import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MONITORING_RANGE_PRESET,
  monitoringDetailsForArea,
  runWithConcurrency,
  useSaplingSystemMonitoring,
} from './useSaplingSystemMonitoring'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('@/services/api.system.service', () => ({
  default: { get: apiGet },
}))

describe('system monitoring request scheduling', () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults the monitoring page to the last hour', () => {
    expect(DEFAULT_MONITORING_RANGE_PRESET).toBe('1h')
  })

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

  it('loads both metric and request series in the performance area', () => {
    expect(monitoringDetailsForArea('performance')).toEqual(['series', 'requests'])
  })

  it('prioritizes service health and capacity series in the services area', () => {
    expect(monitoringDetailsForArea('services')).toEqual(['services', 'series'])
  })

  it('initializes the environment before loading the active area', async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === 'monitoring/environments') {
        return {
          current: 'Homeoffice',
          environments: [{ key: 'Homeoffice', label: 'Homeoffice', type: 'development' }],
        }
      }
      if (path.startsWith('monitoring/series?')) return { series: [] }
      if (path.startsWith('monitoring/services?')) return { services: [] }
      if (path.startsWith('monitoring/incidents?')) return []
      return {}
    })

    const wrapper = mount(
      defineComponent({
        setup() {
          useSaplingSystemMonitoring(ref('services'))
          return () => h('div')
        },
      }),
    )

    await flushPromises()
    await flushPromises()

    const paths = apiGet.mock.calls.map(([path]) => String(path))
    expect(paths[0]).toBe('monitoring/environments')
    expect(paths.find((path) => path.startsWith('monitoring/summary?'))).toContain(
      'environment=Homeoffice',
    )
    expect(paths.find((path) => path.startsWith('monitoring/series?'))).toContain(
      'environment=Homeoffice',
    )

    wrapper.unmount()
  })
})
