import { flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnFilterItem, EntityTemplate } from '@/entity/structure'
import type { SaplingTableTestState } from './useSaplingTable.test-support'
import {
  apiFindMock,
  cleanupTableTestWrappers,
  createDeferred,
  getEntityTemplateMock,
  listFormConfigsMock,
  loadGenericMock,
  mountAdditionalProjectionTestHost,
  mountBeforeInitialLoadTestHost,
  mountManualTestHost,
  mountTestHost,
  resetTableTestMocks,
} from './useSaplingTable.test-support'

describe('useSaplingTable initialization and loading', () => {
  beforeEach(resetTableTestMocks)
  afterEach(cleanupTableTestWrappers)

  it('ignores stale entity initialization when the route entity changes quickly', async () => {
    const entityHandle = ref('partner')
    const partnerDeferred = createDeferred<void>()
    const contractDeferred = createDeferred<void>()

    loadGenericMock.mockImplementation((handle: string) => {
      if (handle === 'partner') {
        return partnerDeferred.promise
      }

      if (handle === 'contract') {
        return contractDeferred.promise
      }

      return Promise.resolve()
    })

    apiFindMock.mockResolvedValue({
      data: [{ handle: 7, title: 'Contract A' }],
      meta: { total: 1 },
    })

    const wrapper = mountTestHost(entityHandle)
    await nextTick()

    entityHandle.value = 'contract'
    await nextTick()

    partnerDeferred.resolve()
    await flushPromises()

    expect(apiFindMock).not.toHaveBeenCalled()

    contractDeferred.resolve()
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(apiFindMock).toHaveBeenCalledWith(
      'contract',
      expect.objectContaining({
        filter: {},
        page: 1,
        limit: 25,
      }),
    )
    expect(wrapper.vm.items).toEqual([{ handle: 7, title: 'Contract A' }])
    expect(wrapper.vm.totalItems).toBe(1)
  })

  it('ignores stale column filter updates while entity state is resetting', async () => {
    const entityHandle = ref('partner')
    const partnerDeferred = createDeferred<void>()
    const contractDeferred = createDeferred<void>()

    loadGenericMock.mockImplementation((handle: string) => {
      if (handle === 'partner') {
        return partnerDeferred.promise
      }

      if (handle === 'contract') {
        return contractDeferred.promise
      }

      return Promise.resolve()
    })

    apiFindMock.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })

    const wrapper = mountTestHost(entityHandle)
    await nextTick()

    entityHandle.value = 'contract'
    await nextTick()

    const staleFilter: Record<string, ColumnFilterItem> = {
      handle: {
        operator: 'eq',
        value: 'partner',
      },
    }

    wrapper.vm.onColumnFiltersUpdate(staleFilter)

    expect(wrapper.vm.columnFilters).toEqual({})

    partnerDeferred.resolve()
    contractDeferred.resolve()
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledWith(
      'contract',
      expect.objectContaining({
        filter: {},
      }),
    )
  })

  it('debounces repeated search-triggered reloads into a single request', async () => {
    vi.useFakeTimers()
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })

    const wrapper = mountTestHost(ref('partner'))
    await flushPromises()
    apiFindMock.mockClear()

    wrapper.vm.onSearchUpdate('Ada')
    await nextTick()
    wrapper.vm.onSearchUpdate('Adab')
    await nextTick()

    expect(apiFindMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(249)
    expect(apiFindMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(apiFindMock).toHaveBeenCalledWith(
      'partner',
      expect.objectContaining({
        filter: {
          $or: [{ name: { $ilike: '%Adab%' } }],
        },
      }),
    )
  })

  it('uses an initial search value for the first manual initialization request', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockResolvedValue({
      data: [{ handle: 1, name: 'Ada Lovelace' }],
      meta: { total: 1 },
    })

    const wrapper = mountManualTestHost(ref('partner'))

    await wrapper.vm.initializeEntityState({ initialSearch: 'Ada' })
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(apiFindMock).toHaveBeenCalledWith(
      'partner',
      expect.objectContaining({
        filter: {
          $or: [{ name: { $ilike: '%Ada%' } }],
        },
        page: 1,
        limit: 25,
      }),
    )
    expect(wrapper.vm.search).toBe('Ada')
  })

  it('includes view-required fields that are hidden from the table projection', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 0 } })

    mountAdditionalProjectionTestHost(ref('document'), ['filename', 'mimetype', 'filename'])
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledWith(
      'document',
      expect.objectContaining({
        fields: expect.arrayContaining(['filename', 'mimetype']),
      }),
    )

    const fields = apiFindMock.mock.calls[0]?.[1]?.fields as string[]
    expect(fields.filter((field) => field === 'filename')).toHaveLength(1)
  })

  it('runs the initial load hook before the first request', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockResolvedValue({
      data: [{ handle: 1, name: 'Ada Lovelace' }],
      meta: { total: 1 },
    })

    const beforeInitialLoadMock = vi.fn((table: SaplingTableTestState) => {
      table.parentFilter.value = { owner: { $in: [42] } }
    })

    mountBeforeInitialLoadTestHost(ref('partner'), beforeInitialLoadMock)
    await flushPromises()

    expect(beforeInitialLoadMock).toHaveBeenCalledTimes(1)
    expect(beforeInitialLoadMock.mock.invocationCallOrder[0]).toBeLessThan(
      apiFindMock.mock.invocationCallOrder[0],
    )
    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(apiFindMock).toHaveBeenCalledWith(
      'partner',
      expect.objectContaining({
        filter: { owner: { $in: [42] } },
      }),
    )
  })

  it('loads the first table page before delayed form config context', async () => {
    vi.useFakeTimers()
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockResolvedValue({
      data: [{ handle: 1, name: 'Ada Lovelace' }],
      meta: { total: 1 },
    })

    mountTestHost(ref('partner'))
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledTimes(1)
    expect(getEntityTemplateMock).not.toHaveBeenCalled()
    expect(listFormConfigsMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()

    expect(getEntityTemplateMock).toHaveBeenCalledWith('partner')
    expect(listFormConfigsMock).toHaveBeenCalledWith('partner')
  })

  it('selects the configured default view and keeps the standard view metadata-only', async () => {
    vi.useFakeTimers()
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 0 } })
    getEntityTemplateMock.mockResolvedValue([
      {
        name: 'name',
        key: 'name',
        title: 'Name',
        type: 'string',
        options: [],
        isAutoIncrement: false,
        isPersistent: true,
        tableVisible: false,
        mobileVisible: false,
        isReference: false,
        referencedPks: [],
      } as EntityTemplate,
    ])
    listFormConfigsMock.mockResolvedValue([
      {
        handle: 7,
        name: 'Tickets',
        entity: 'partner',
        scope: 'person',
        scopeHandle: '1',
        isActive: true,
        isDefault: true,
        version: 1,
        config: {
          schema: 'sapling.form-config.v1',
          entityHandle: 'partner',
          fields: {
            name: {
              tableVisible: true,
            },
          },
        },
      },
    ])

    const wrapper = mountTestHost(ref('partner'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()

    expect(wrapper.vm.selectedFormConfigHandle).toBe(7)
    expect(wrapper.vm.selectedFormConfigLabel).toBe('Tickets')
    expect(
      wrapper.vm.entityTemplates.find((template) => template.name === 'name')?.tableVisible,
    ).toBe(true)

    wrapper.vm.selectFormConfig(null)
    await nextTick()

    expect(wrapper.vm.selectedFormConfigHandle).toBeNull()
    expect(
      wrapper.vm.entityTemplates.find((template) => template.name === 'name')?.tableVisible,
    ).toBe(false)
  })
})
