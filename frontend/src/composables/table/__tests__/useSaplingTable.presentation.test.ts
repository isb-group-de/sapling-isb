import { flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiFindMock,
  loadGenericMock,
  mountQueryEnabledTestHost,
  routeState,
  cleanupTableTestWrappers,
  createTemplate,
  mountBehaviorTestHost,
  resetTableTestMocks,
  setMockedEntityTemplates,
} from './useSaplingTable.test-support'
import { useTablePreferences } from '../saplingTablePreferences'

describe('table presentation queries', () => {
  beforeEach(resetTableTestMocks)
  afterEach(cleanupTableTestWrappers)

  it('projects hidden deadline fields and keeps server grouping before within-group sorting on every page', async () => {
    vi.useFakeTimers()
    const entity = ref('grouped-test')
    setMockedEntityTemplates(entity.value, [
      createTemplate({ name: 'title', type: 'string', options: ['isOrderASC'] }),
      createTemplate({ name: 'status', type: 'string', tableVisible: true }),
      createTemplate({
        name: 'due',
        type: 'datetime',
        options: ['isDeadline'],
        tableVisible: false,
      }),
    ])
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 80 } })
    const prefs = useTablePreferences(entity)
    prefs.value = { ...prefs.value, showGrouping: true, groupField: 'status' }
    const wrapper = mountBehaviorTestHost(entity, { allowGrouping: true })
    await flushPromises()
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({
        orderBy: { status: 'ASC', title: 'ASC' },
        fields: expect.arrayContaining(['status', 'due']),
      }),
    )
    wrapper.vm.onSortByUpdate([{ key: 'title', order: 'desc' }])
    wrapper.vm.onPageUpdate(2)
    await nextTick()
    await vi.advanceTimersByTimeAsync(250)
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ page: 2, orderBy: { status: 'ASC', title: 'DESC' } }),
    )
    prefs.value = { ...prefs.value, showGrouping: false }
    await nextTick()
    await vi.advanceTimersByTimeAsync(250)
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ page: 1, orderBy: { title: 'DESC' } }),
    )
  })

  it('applies multiple visible group levels and suspends a level when its column is hidden', async () => {
    vi.useFakeTimers()
    const entity = ref('multi-group-test')
    setMockedEntityTemplates(entity.value, [
      createTemplate({ name: 'status', type: 'string' }),
      createTemplate({ name: 'priority', type: 'string' }),
      createTemplate({ name: 'secret', type: 'string', tableVisible: false }),
    ])
    const prefs = useTablePreferences(entity)
    prefs.value = {
      ...prefs.value,
      showGrouping: true,
      groupFields: ['status', 'secret', 'priority'],
    }
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 80 } })
    const wrapper = mountBehaviorTestHost(entity, { allowGrouping: true })
    await flushPromises()
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ orderBy: { status: 'ASC', priority: 'ASC' } }),
    )
    wrapper.vm.onGroupableColumnKeysUpdate(['priority'])
    await nextTick()
    await vi.advanceTimersByTimeAsync(250)
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ orderBy: { priority: 'ASC' } }),
    )
  })

  it('preserves a URL page when saved grouping becomes available during metadata loading', async () => {
    const entity = ref('restored-group-page')
    routeState.query = { page: '3' }
    const prefs = useTablePreferences(entity)
    prefs.value = { ...prefs.value, showGrouping: true, groupField: 'title' }
    loadGenericMock.mockImplementation(async () => {
      setMockedEntityTemplates(entity.value, [createTemplate({ name: 'title', type: 'string' })])
    })
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 80 } })
    const wrapper = mountQueryEnabledTestHost(entity, { allowGrouping: true })
    await flushPromises()
    expect(wrapper.vm.page).toBe(3)
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ page: 3, orderBy: { title: 'ASC' } }),
    )
  })

  it('restores URL grouping over local preferences, writes changes and loads an ungrouped worklist', async () => {
    vi.useFakeTimers()
    const entity = ref('url-group-roundtrip')
    setMockedEntityTemplates(entity.value, [
      createTemplate({ name: 'status', type: 'string' }),
      createTemplate({ name: 'priority', type: 'string' }),
      createTemplate({ name: 'hidden', type: 'string', tableVisible: false }),
    ])
    const prefs = useTablePreferences(entity)
    prefs.value = { ...prefs.value, showGrouping: false, groupFields: [] }
    routeState.query = {
      grouping: JSON.stringify({ fields: ['status', 'hidden', 'priority'], visible: true }),
      page: '2',
    }
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 80 } })
    const wrapper = mountQueryEnabledTestHost(entity, { allowGrouping: true })
    await flushPromises()
    expect(prefs.value.showGrouping).toBe(true)
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ page: 2, orderBy: { status: 'ASC', priority: 'ASC' } }),
    )
    prefs.value = { ...prefs.value, groupFields: ['priority', 'status'] }
    await nextTick()
    await vi.advanceTimersByTimeAsync(250)
    expect(JSON.parse(new URLSearchParams(window.location.search).get('grouping')!)).toEqual({
      fields: ['priority', 'status'],
      visible: true,
    })
    wrapper.unmount()
    routeState.query = { grouping: JSON.stringify({ fields: [], visible: false }) }
    mountQueryEnabledTestHost(entity, { allowGrouping: true })
    await flushPromises()
    expect(prefs.value.showGrouping).toBe(false)
    expect(prefs.value.groupFields).toEqual([])
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ orderBy: {} }),
    )
  })

  it('ignores saved grouping in embedded tables', async () => {
    const entity = ref('embedded-test')
    setMockedEntityTemplates(entity.value, [
      createTemplate({ name: 'title', type: 'string', options: ['isOrderASC'] }),
    ])
    const prefs = useTablePreferences(entity)
    prefs.value = { ...prefs.value, showGrouping: true, groupField: 'title' }
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 0 } })
    const wrapper = mountBehaviorTestHost(entity, {})
    await flushPromises()
    wrapper.vm.onSortByUpdate([])
    await wrapper.vm.loadData()
    expect(apiFindMock).toHaveBeenLastCalledWith(
      entity.value,
      expect.objectContaining({ orderBy: {} }),
    )
  })
})
