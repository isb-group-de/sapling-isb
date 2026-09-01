import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  apiFindAllMock,
  apiFindMock,
  cleanupTableTestWrappers,
  formatLocalDateTimeInput,
  loadGenericMock,
  mountBehaviorTestHost,
  mountQueryEnabledTestHost,
  mountTestHost,
  resetTableTestMocks,
  routeState,
} from './useSaplingTable.test-support'
import { getSaplingTableRouteStateSignature } from '../saplingTableRouteState'

describe('useSaplingTable filters and route state', () => {
  beforeEach(resetTableTestMocks)
  afterEach(cleanupTableTestWrappers)

  it('ignores dialog-only query changes when deciding whether to reinitialize the table', () => {
    const filter = JSON.stringify({ status: { handle: 'closed' } })
    const baseSignature = getSaplingTableRouteStateSignature({ filter }, true)

    expect(getSaplingTableRouteStateSignature({ filter, open: '2' }, true)).toBe(baseSignature)
    expect(getSaplingTableRouteStateSignature({ filter, open: '3' }, true)).toBe(baseSignature)
    expect(
      getSaplingTableRouteStateSignature({ filter, open: '3', context: 'calendar' }, true),
    ).toBe(baseSignature)
    expect(
      getSaplingTableRouteStateSignature(
        { filter: JSON.stringify({ status: { handle: 'open' } }), open: '3' },
        true,
      ),
    ).not.toBe(baseSignature)
  })

  it('applies default open filters for chip references with isOpen values', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    apiFindAllMock.mockResolvedValue([
      { handle: 'open', description: 'Open', isOpen: true },
      { handle: 'waiting', description: 'Waiting', isOpen: true },
      { handle: 'closed', description: 'Closed', isOpen: false },
    ])
    apiFindMock.mockResolvedValue({
      data: [{ handle: 1, title: 'Open ticket' }],
      meta: { total: 1 },
    })

    const wrapper = mountTestHost(ref('ticket'))
    await flushPromises()

    expect(wrapper.vm.columnFilters).toEqual({
      status: {
        operator: 'eq',
        value: '',
        relationItems: [{ handle: 'open' }, { handle: 'waiting' }],
      },
    })
    expect(apiFindMock).toHaveBeenLastCalledWith(
      'ticket',
      expect.objectContaining({
        filter: {
          status: {
            handle: { $in: ['open', 'waiting'] },
          },
        },
      }),
    )
  })

  it('can skip default open filters for duplicate-check result tables', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    apiFindAllMock.mockResolvedValue([
      { handle: 'open', description: 'Open', isOpen: true },
      { handle: 'closed', description: 'Closed', isOpen: false },
    ])
    apiFindMock.mockResolvedValue({ data: [], meta: { total: 0 } })

    const wrapper = mountBehaviorTestHost(ref('duplicateTicket'), {
      searchFieldNames: ['title'],
      applyDefaultOpenChipFilters: false,
    })
    await flushPromises()

    expect(apiFindAllMock).not.toHaveBeenCalled()
    expect(wrapper.vm.columnFilters).toEqual({})
    expect(apiFindMock).toHaveBeenCalledWith(
      'duplicateTicket',
      expect.objectContaining({ filter: {} }),
    )
  })

  it('applies decoded route query filters when query parameters are enabled', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    routeState.query = {
      filter: '{"status":{"handle":"open"},"assigneePerson":{"handle":"{{currentUser.handle}}"}}',
    }
    apiFindMock.mockResolvedValue({
      data: [{ handle: 1, title: 'Open ticket' }],
      meta: { total: 1 },
    })

    const wrapper = mountQueryEnabledTestHost(ref('ticket'))
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledWith(
      'ticket',
      expect.objectContaining({
        relations: ['status', 'assigneePerson', 'assigneePerson.company'],
        filter: {
          $and: [
            { status: { handle: 'open' } },
            { assigneePerson: { handle: '{{currentUser.handle}}' } },
          ],
        },
      }),
    )
    expect(wrapper.vm.columnFilters).toEqual({
      status: {
        operator: 'eq',
        value: '',
        relationItems: [{ handle: 'open' }],
      },
      assigneePerson: {
        operator: 'eq',
        value: '',
        relationItems: [{ handle: '{{currentUser.handle}}' }],
      },
    })
    expect(wrapper.vm.items).toEqual([{ handle: 1, title: 'Open ticket' }])
    expect(wrapper.vm.totalItems).toBe(1)
  })

  it('clamps legacy route page sizes to the generic API maximum', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    routeState.query = {
      itemsPerPage: '200',
    }
    apiFindMock.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })

    const wrapper = mountQueryEnabledTestHost(ref('partner'))
    await flushPromises()

    expect(wrapper.vm.itemsPerPage).toBe(100)
    expect(apiFindMock).toHaveBeenCalledWith(
      'partner',
      expect.objectContaining({
        limit: 100,
      }),
    )
  })

  it('restores supported route query filters into the table header state before loading', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    routeState.query = {
      filter:
        '{"$and":[{"name":{"$ilike":"%Ada%"}},{"status":{"$in":["open","pending"]}},{"amount":{"$gte":5,"$lte":10}}]}',
    }
    apiFindMock.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })

    const wrapper = mountQueryEnabledTestHost(ref('partner'))
    await flushPromises()

    expect(wrapper.vm.columnFilters).toEqual({
      name: {
        operator: 'like',
        value: 'Ada',
      },
      status: {
        operator: 'eq',
        value: '',
        relationItems: [{ handle: 'open' }, { handle: 'pending' }],
      },
      amount: {
        operator: 'between',
        value: '',
        rangeStart: '5',
        rangeEnd: '10',
        rangeStartOperator: 'gte',
        rangeEndOperator: 'lte',
      },
    })
    expect(apiFindMock).toHaveBeenCalledTimes(1)
  })

  it('does not restore a serialized global search as an additional parent filter', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    routeState.query = {
      search: 'Ada Lovelace',
      filter: JSON.stringify({
        $or: [{ name: { $ilike: '%Ada Lovelace%' } }],
      }),
    }
    apiFindMock.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    })

    mountQueryEnabledTestHost(ref('partner'))
    await flushPromises()

    expect(apiFindMock).toHaveBeenCalledWith(
      'partner',
      expect.objectContaining({
        filter: {
          $and: [
            { $or: [{ name: { $ilike: '%Ada%' } }] },
            { $or: [{ name: { $ilike: '%Lovelace%' } }] },
          ],
        },
      }),
    )
  })

  it('rehydrates the full url filter into table header filters without a leftover query filter', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    routeState.query = {
      filter:
        '{"status":{"handle":{"$nin":["closed"]}},"deadlineDate":{"$lt":"{{tomorrow.start}}","$gte":"{{today.start}}"},"assigneePerson":{"handle":"{{currentUser.handle}}"}}',
    }
    apiFindMock.mockResolvedValue({
      data: [{ handle: 17, title: 'Today ticket' }],
      meta: { total: 1 },
    })

    const wrapper = mountQueryEnabledTestHost(ref('ticket'))
    await flushPromises()

    expect(wrapper.vm.columnFilters).toEqual({
      status: {
        operator: 'nin',
        value: '',
        relationItems: [{ handle: 'closed' }],
      },
      deadlineDate: {
        operator: 'between',
        value: '',
        rangeStart: '{{today.start}}',
        rangeEnd: '{{tomorrow.start}}',
        rangeStartOperator: 'gte',
        rangeEndOperator: 'lt',
      },
      assigneePerson: {
        operator: 'eq',
        value: '',
        relationItems: [{ handle: '{{currentUser.handle}}' }],
      },
    })

    expect(apiFindMock).toHaveBeenCalledWith(
      'ticket',
      expect.objectContaining({
        filter: {
          $and: [
            {
              status: { handle: { $nin: ['closed'] } },
            },
            {
              $and: [
                {
                  deadlineDate: {
                    $gte: '{{today.start}}',
                  },
                },
                {
                  deadlineDate: {
                    $lt: '{{tomorrow.start}}',
                  },
                },
              ],
            },
            {
              assigneePerson: { handle: '{{currentUser.handle}}' },
            },
          ],
        },
      }),
    )
  })

  it('restores timeline drilldown date filters into table header filters', async () => {
    const monthStartUtc = '2026-06-30T22:00:00.000Z'
    const nextMonthStartUtc = '2026-07-31T22:00:00.000Z'
    const monthStartInputValue = formatLocalDateTimeInput(monthStartUtc)
    const nextMonthStartInputValue = formatLocalDateTimeInput(nextMonthStartUtc)

    loadGenericMock.mockResolvedValue(undefined)
    routeState.query = {
      filter: JSON.stringify({
        $and: [
          {
            creatorCompany: 4,
          },
          {
            $and: [
              {
                startDate: { $lt: nextMonthStartUtc },
              },
              {
                endDate: { $gte: monthStartUtc },
              },
            ],
          },
          {
            isAllDay: true,
          },
        ],
      }),
    }
    apiFindMock.mockResolvedValue({
      data: [{ handle: 7, title: 'Vacation in July' }],
      meta: { total: 1 },
    })

    const wrapper = mountQueryEnabledTestHost(ref('event'))
    await flushPromises()

    expect(wrapper.vm.columnFilters).toEqual({
      creatorCompany: {
        operator: 'eq',
        value: '',
        relationItems: [{ handle: 4 }],
      },
      isAllDay: {
        operator: 'eq',
        value: 'true',
      },
      startDate: {
        operator: 'lt',
        value: nextMonthStartInputValue,
      },
      endDate: {
        operator: 'gte',
        value: monthStartInputValue,
      },
    })
    expect(apiFindMock).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({
        filter: {
          $and: [
            {
              creatorCompany: { handle: 4 },
            },
            {
              startDate: { $lt: nextMonthStartInputValue },
            },
            {
              endDate: { $gte: monthStartInputValue },
            },
            {
              isAllDay: { $eq: true },
            },
          ],
        },
      }),
    )
  })
})
