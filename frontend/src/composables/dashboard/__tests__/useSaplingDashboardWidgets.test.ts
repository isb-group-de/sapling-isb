import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSaplingDashboard } from '../useSaplingDashboard'
import { useSaplingDashboardLayout } from '../useSaplingDashboardLayout'
import type { DashboardItem } from '@/entity/entity'
import type { DashboardWidget } from '@/entity/dashboard-widget.types'

const api = vi.hoisted(() => ({ create: vi.fn(), findAll: vi.fn(), layout: vi.fn() }))
vi.mock('@/services/api.generic.service', () => ({
  default: {
    create: api.create,
    findAll: api.findAll,
    find: vi.fn().mockResolvedValue({ data: [] }),
  },
}))
vi.mock('@/services/api.template.service', () => ({
  default: { getEntityTemplate: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/services/api.current.service', () => ({
  default: { updateDashboardLayout: api.layout },
}))
vi.mock('@/composables/generic/useTranslationLoader', () => ({
  useTranslationLoader: () => ({ isLoading: false, loadTranslations: vi.fn() }),
}))
vi.mock('@/composables/system/useSaplingMessageCenter', () => ({
  useSaplingMessageCenter: () => ({ pushMessage: vi.fn() }),
}))
vi.mock('@/stores/currentPersonStore', () => ({
  useCurrentPersonStore: () => ({ person: { handle: 7 }, fetchCurrentPerson: vi.fn() }),
}))

const widgets: DashboardWidget[] = [
  {
    id: 'note',
    title: 'Notes',
    kind: 'NOTE',
    columns: 1,
    rows: 2,
    config: { markdown: '# Plan\n- [ ] Review' },
  },
  {
    id: 'actions',
    title: 'Create',
    kind: 'ACTIONS',
    columns: 1,
    rows: 1,
    config: { actions: [{ id: 'create-ticket', entity: 'ticket', label: 'New ticket' }] },
  },
  {
    id: 'table',
    title: 'Tickets',
    kind: 'TABLE',
    columns: 2,
    rows: 4,
    config: {
      entity: 'ticket',
      filter: { status: 'open' },
      columns: ['title', 'status'],
      sortBy: [{ key: 'title', order: 'desc' }],
      search: 'server',
      pageSize: 20,
    },
  },
  {
    id: 'agenda',
    title: 'Agenda',
    kind: 'AGENDA',
    columns: 1,
    rows: 2,
    config: { filter: { status: 'confirmed' }, days: 30, limit: 10 },
  },
  {
    id: 'website',
    title: 'Site',
    kind: 'WEBSITE',
    columns: 1,
    rows: 2,
    config: { url: 'https://example.com', mode: 'embed' },
  },
  { id: 'kpi', title: 'Value', kind: 'KPI', columns: 1, rows: 1, config: { kpiHandle: 3 } },
]

describe('complete widget dashboard workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.findAll.mockResolvedValue([])
    api.create.mockResolvedValue({ handle: 9 })
    api.layout.mockResolvedValue({})
  })

  it('saves the originating dashboard snapshot and loads every setting atomically', async () => {
    let workspace!: ReturnType<typeof useSaplingDashboard>
    const wrapper = mount(
      defineComponent({
        setup() {
          workspace = useSaplingDashboard()
          return () => null
        },
      }),
    )
    await flushPromises()
    workspace.dashboards.value = [
      { handle: 1, name: 'Original', widgets: structuredClone(widgets) } as DashboardItem,
      { handle: 2, name: 'Other', widgets: [], person: 7, createdAt: null },
    ]
    workspace.openDashboardTemplateSaveDialog()
    workspace.activeTab.value = 1
    workspace.dashboards.value[0]!.widgets![0]!.title = 'Later edit'
    await workspace.onDashboardTemplateSave({ name: 'Template' }, 'saveAndClose')
    expect(api.create).toHaveBeenLastCalledWith(
      'dashboardTemplate',
      expect.objectContaining({ widgets }),
    )
    expect(api.create.mock.calls[api.create.mock.calls.length - 1]?.[1]).not.toHaveProperty(
      'person',
    )
    api.create.mockClear()
    await workspace.loadDashboardFromTemplate({
      handle: 8,
      name: 'Copy',
      widgets: structuredClone(widgets),
    } as never)
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(api.create).toHaveBeenCalledWith('dashboard', expect.objectContaining({ widgets }))
    wrapper.unmount()
  })

  it('restores removed widgets, configuration and order when cancelling a layout draft', () => {
    const dashboards = ref([
      { handle: 1, name: 'Dashboard', widgets: structuredClone(widgets) } as DashboardItem,
    ])
    const activeTab = ref(0)
    const layout = useSaplingDashboardLayout({
      dashboards,
      activeTab,
      currentDashboard: computed(() => dashboards.value[0]!),
      pushMessage: vi.fn(),
    })
    layout.beginLayoutEdit()
    layout.updateDashboardWidgets(1, [{ ...widgets[0]!, title: 'Changed', rows: 1 }])
    layout.cancelLayoutEdit()
    expect(dashboards.value[0]!.widgets).toEqual(widgets)
    expect(api.layout).not.toHaveBeenCalled()
  })

  it('persists the full widget draft and retains it after a rejected save', async () => {
    const dashboards = ref([
      { handle: 1, name: 'Dashboard', widgets: structuredClone(widgets) } as DashboardItem,
    ])
    const layout = useSaplingDashboardLayout({
      dashboards,
      activeTab: ref(0),
      currentDashboard: computed(() => dashboards.value[0]!),
      pushMessage: vi.fn(),
    })
    layout.beginLayoutEdit()
    api.layout.mockRejectedValueOnce(new Error('Conflict'))
    await expect(layout.saveLayout()).rejects.toThrow('Conflict')
    expect(layout.isLayoutEditing.value).toBe(true)
    await layout.saveLayout()
    expect(api.layout).toHaveBeenLastCalledWith({
      dashboards: [{ handle: 1, widgets, kpiOrder: [] }],
    })
    expect(layout.isLayoutEditing.value).toBe(false)
  })
})
