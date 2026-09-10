import { flushPromises, shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SaplingSystemMonitoring from './SaplingSystemMonitoring.vue'
import SaplingMonitoringOverviewTab from './SaplingMonitoringOverviewTab.vue'
import SaplingMonitoringHeader from './SaplingMonitoringHeader.vue'
import SaplingDialog from '@/components/common/SaplingDialog.vue'

const incident = {
  handle: 12,
  state: 'open',
  severity: 'warning',
  observedValue: 85,
  threshold: 80,
  rule: { metricKey: 'filesystem.usedPercent', comparator: 'gt', windowSeconds: 300 },
}
const incidents = ref([incident])

vi.mock('@/composables/system/useSaplingSystemMonitoring', () => ({
  useSaplingSystemMonitoring: () => ({
    ...Object.fromEntries(
      [
        'environments',
        'series',
        'requestSeries',
        'requestGroups',
        'users',
        'aiGroups',
        'rules',
        'services',
        'errorGroups',
        'checks',
        'remediations',
      ].map((key) => [key, ref([])]),
    ),
    incidents,
    summary: ref(null),
    collectorStatus: ref(null),
    rangePreset: ref('1h'),
    selectedEnvironment: ref('test'),
    usersTotal: ref(0),
    loading: ref(false),
    areaLoading: ref(false),
    loadAll: vi.fn(),
    updateRule: vi.fn(),
    executeRemediation: vi.fn(),
  }),
}))

async function setup(url = '/system?area=overview&environment=test&range=24h') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/system', component: { template: '<div />' } }],
  })
  await router.push(url)
  const wrapper = shallowMount(SaplingSystemMonitoring, {
    props: {
      systemTitle: 'Test',
      systemSubtitle: '',
      systemReady: true,
      platform: '',
      architecture: '',
      version: '',
      serverTime: '',
      systemRefreshing: false,
    },
    global: {
      plugins: [
        router,
        createI18n({ legacy: false, locale: 'de', missingWarn: false, fallbackWarn: false }),
      ],
      stubs: { VWindow: { template: '<div><slot /></div>' } },
    },
  })
  return { router, wrapper }
}

afterEach(() => {
  incidents.value = [incident]
})

describe('monitoring incident navigation', () => {
  it('opens an overview incident with a single URL update and closes without losing filters', async () => {
    const { router, wrapper } = await setup()
    const replace = vi.spyOn(router, 'replace')
    wrapper.findComponent(SaplingMonitoringOverviewTab).vm.$emit('openIncident', 12)
    await flushPromises()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.query).toEqual({
      area: 'incidents',
      incident: '12',
      environment: 'test',
      range: '24h',
    })
    const dialog = wrapper.findAllComponents(SaplingDialog)[1]!
    expect(dialog.props('modelValue')).toBe(true)
    dialog.vm.$emit('update:modelValue', false)
    await flushPromises()
    expect(router.currentRoute.value.query.incident).toBeUndefined()
    expect(router.currentRoute.value.query.environment).toBe('test')
    expect(dialog.props('modelValue')).toBe(false)
    wrapper.unmount()
  })

  it('waits for deep-link data and follows browser history without leaving an empty scrim', async () => {
    incidents.value = []
    const { router, wrapper } = await setup('/system?area=incidents&incident=12')
    const dialog = wrapper.findAllComponents(SaplingDialog)[1]!
    expect(dialog.props('modelValue')).toBe(false)
    incidents.value = [incident]
    await flushPromises()
    expect(dialog.props('modelValue')).toBe(true)
    await router.push('/system?area=overview')
    expect(wrapper.findComponent(SaplingMonitoringHeader).props('tab')).toBe('overview')
    expect(dialog.props('modelValue')).toBe(false)
    router.back()
    await flushPromises()
    expect(dialog.props('modelValue')).toBe(true)
    expect(wrapper.findComponent(SaplingMonitoringHeader).props('tab')).toBe('incidents')
    await router.push('/system?area=incidents&incident=9999')
    expect(dialog.props('modelValue')).toBe(false)
    wrapper.unmount()
  })
})
