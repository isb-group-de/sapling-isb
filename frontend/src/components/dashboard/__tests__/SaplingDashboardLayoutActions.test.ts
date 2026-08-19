import { config, shallowMount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import SaplingDashboardTabs from '../SaplingDashboardTabs.vue'
import SaplingKpis from '../SaplingKpis.vue'
import SaplingKpiCard from '@/components/kpi/SaplingKpiCard.vue'

const mocks = vi.hoisted(() => ({
  openAddKpiDialog: vi.fn(),
  openKpiDeleteDialog: vi.fn(),
  useSaplingKpiCard: vi.fn(),
  useSaplingKpis: vi.fn(),
  useSaplingSortableDrag: vi.fn(),
}))

vi.mock('@/composables/dashboard/useSaplingKpis', () => ({
  useSaplingKpis: (...args: unknown[]) => mocks.useSaplingKpis(...args),
}))

vi.mock('@/composables/dashboard/useSaplingSortableDrag', () => ({
  useSaplingSortableDrag: (...args: unknown[]) => mocks.useSaplingSortableDrag(...args),
}))

vi.mock('@/composables/kpi/useSaplingKpiCard', () => ({
  useSaplingKpiCard: (...args: unknown[]) => mocks.useSaplingKpiCard(...args),
}))

const dashboard = {
  handle: 3,
  name: 'Vertrieb',
  kpis: [{ handle: 7, name: 'Umsatz', type: 'ITEM' }],
}

function mountOptions() {
  return {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  }
}

describe('dashboard layout removal actions', () => {
  beforeAll(() => {
    config.global.renderStubDefaultSlot = true
  })

  afterAll(() => {
    config.global.renderStubDefaultSlot = false
  })

  beforeEach(() => {
    mocks.openKpiDeleteDialog.mockClear()
    mocks.openAddKpiDialog.mockClear()
    mocks.useSaplingSortableDrag.mockReturnValue({
      draggedHandle: ref(null),
      dropTargetHandle: ref(null),
      start: vi.fn(),
      enter: vi.fn(),
      over: vi.fn(),
      finish: vi.fn(),
    })
    mocks.useSaplingKpis.mockReturnValue({
      kpis: ref(dashboard.kpis),
      kpiDeleteDialog: ref(false),
      kpiToDelete: ref(null),
      addKpiDialog: ref(false),
      selectedKpi: ref(null),
      availableKpis: ref([]),
      validateAndAddKpi: vi.fn(),
      closeAddKpiDialog: vi.fn(),
      openKpiDeleteDialog: mocks.openKpiDeleteDialog,
      confirmKpiDelete: vi.fn(),
      cancelKpiDelete: vi.fn(),
      openAddKpiDialog: mocks.openAddKpiDialog,
      reorderKpis: vi.fn(),
    })
    mocks.useSaplingKpiCard.mockReturnValue({
      setRef: vi.fn(),
      refreshKpi: vi.fn(),
      openKpiDeleteDialog: vi.fn(),
      openEntity: vi.fn(),
      title: computed(() => 'Umsatz'),
      truncatedTitle: computed(() => 'Umsatz'),
      hasTruncatedTitle: computed(() => false),
      description: computed(() => ''),
      hasInfoTooltip: computed(() => false),
      kpiTypeLabel: computed(() => 'Wert'),
      canOpenEntity: computed(() => true),
      isListKpi: computed(() => false),
      isBreakdownKpi: computed(() => false),
      isItemKpi: computed(() => true),
      isTrendKpi: computed(() => false),
      isComparisonKpi: computed(() => false),
      isSparklineKpi: computed(() => false),
      isCalendarKpi: computed(() => false),
    })
  })

  it('passes the KPI delete action only while layout editing is active', async () => {
    const wrapper = shallowMount(SaplingKpis, {
      props: { dashboard: dashboard as never, layoutEditing: false },
      ...mountOptions(),
    })

    expect(wrapper.findComponent(SaplingKpiCard).props('onDelete')).toBeUndefined()

    await wrapper.setProps({ layoutEditing: true })
    const onDelete = wrapper.findComponent(SaplingKpiCard).props('onDelete') as () => void
    expect(onDelete).toBeTypeOf('function')

    onDelete()
    expect(mocks.openKpiDeleteDialog).toHaveBeenCalledWith(7)
  })

  it('renders dashboard delete buttons only while layout editing is active', async () => {
    const wrapper = shallowMount(SaplingDashboardTabs, {
      props: {
        dashboards: [dashboard, { ...dashboard, handle: 4, name: 'Service' }] as never,
        activeTab: 0,
        addKpiRequestKey: 0,
        addKpiRequestDashboardHandle: null,
        isDashboardRemovable: true,
        layoutEditing: false,
      },
      ...mountOptions(),
    })

    expect(wrapper.findAll('.sapling-dashboard__tab-remove')).toHaveLength(0)

    await wrapper.setProps({ layoutEditing: true })
    expect(wrapper.findAll('.sapling-dashboard__tab-remove')).toHaveLength(2)
  })

  it('opens each KPI add request once without replaying it after tab changes', async () => {
    const wrapper = shallowMount(SaplingKpis, {
      props: {
        dashboard: dashboard as never,
        layoutEditing: false,
        openAddRequest: 0,
      },
      ...mountOptions(),
    })

    await wrapper.setProps({ openAddRequest: 1 })
    expect(mocks.openAddKpiDialog).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ openAddRequest: 0 })
    await wrapper.setProps({ openAddRequest: 1 })
    expect(mocks.openAddKpiDialog).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ openAddRequest: 2 })
    expect(mocks.openAddKpiDialog).toHaveBeenCalledTimes(2)
  })

  it('keeps the KPI add request scoped to its originating dashboard', async () => {
    const wrapper = shallowMount(SaplingDashboardTabs, {
      props: {
        dashboards: [dashboard, { ...dashboard, handle: 4, name: 'Service' }] as never,
        activeTab: 0,
        addKpiRequestKey: 1,
        addKpiRequestDashboardHandle: 3,
        isDashboardRemovable: true,
        layoutEditing: false,
      },
      ...mountOptions(),
    })

    expect(
      wrapper.findAllComponents(SaplingKpis).map((kpis) => kpis.props('openAddRequest')),
    ).toEqual([1, 0])

    await wrapper.setProps({ activeTab: 1 })
    expect(
      wrapper.findAllComponents(SaplingKpis).map((kpis) => kpis.props('openAddRequest')),
    ).toEqual([1, 0])
  })

  it('renders the KPI card delete button only when a delete action is available', () => {
    const withoutDelete = shallowMount(SaplingKpiCard, {
      props: { kpi: dashboard.kpis[0] as never, kpiIdx: 0 },
      ...mountOptions(),
    })
    const withDelete = shallowMount(SaplingKpiCard, {
      props: { kpi: dashboard.kpis[0] as never, kpiIdx: 0, onDelete: vi.fn() },
      ...mountOptions(),
    })

    expect(withoutDelete.find('[title="kpi.removeKpi"]').exists()).toBe(false)
    expect(withDelete.find('[title="kpi.removeKpi"]').exists()).toBe(true)
    expect(
      withDelete.find('[title="kpi.removeKpi"]').classes('sapling-kpi-card__action--delete'),
    ).toBe(true)
  })
})
