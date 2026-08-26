import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingKpiCalendar from '../SaplingKpiCalendar.vue'

const calendarMock = vi.hoisted(() => ({
  useSaplingKpiCalendar: vi.fn(),
}))

const harness = {
  entries: ref<Array<Record<string, unknown>>>([]),
  loading: ref(false),
  hasError: ref(false),
  isLoaded: ref(true),
  hasData: ref(false),
  hasConfigurationError: ref(false),
  loadKpiValue: vi.fn(),
  refresh: vi.fn(),
  openEvent: vi.fn(),
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('de-DE'),
  }),
}))

vi.mock('@/composables/kpi/useSaplingKpiCalendar', () => ({
  useSaplingKpiCalendar: (...args: unknown[]) => calendarMock.useSaplingKpiCalendar(...args),
}))

function mountCalendar() {
  return mount(SaplingKpiCalendar, {
    props: {
      kpi: {
        handle: 1,
        name: 'Agenda',
        aggregation: { handle: 'COUNT' },
        field: 'handle',
        type: 'CALENDAR',
        targetEntity: 'event',
        createdAt: null,
      } as never,
    },
    global: {
      stubs: {
        VIcon: { template: '<span><slot /></span>' },
        VSkeletonLoader: { template: '<div data-test="skeleton" />' },
      },
    },
  })
}

describe('SaplingKpiCalendar', () => {
  beforeEach(() => {
    calendarMock.useSaplingKpiCalendar.mockReturnValue(harness)
    harness.entries.value = []
    harness.loading.value = false
    harness.hasError.value = false
    harness.isLoaded.value = true
    harness.hasData.value = false
    harness.hasConfigurationError.value = false
    harness.openEvent.mockClear()
  })

  it('keeps configuration and empty states local while omitting general errors', async () => {
    harness.hasConfigurationError.value = true
    const wrapper = mountCalendar()
    expect(wrapper.text()).toContain('kpi.calendarConfigurationError')

    harness.hasConfigurationError.value = false
    harness.hasError.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('exception.unknownError')
    expect(wrapper.text()).not.toContain('kpi.calendarEmpty')

    harness.hasError.value = false
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('kpi.calendarEmpty')
  })

  it('renders an agenda entry and opens its persisted event', async () => {
    const entry = {
      key: '7-1787047200000-0',
      handle: 7,
      title: 'Kundentermin',
      start: new Date('2026-08-18T10:00:00.000Z'),
      end: new Date('2026-08-18T11:00:00.000Z'),
      isAllDay: false,
      icon: 'mdi-account-group',
      color: '#123456',
      metaLabel: 'Besprechung · Kunde',
    }
    harness.entries.value = [entry]
    harness.hasData.value = true
    const wrapper = mountCalendar()

    expect(wrapper.text()).toContain('Kundentermin')
    expect(wrapper.text()).toContain('Besprechung · Kunde')
    expect(wrapper.text()).toContain('mdi-account-group')

    await wrapper.get('button').trigger('click')
    expect(harness.openEvent).toHaveBeenCalledWith(entry)
  })
})
