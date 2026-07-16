import { flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnFilterItem } from '@/entity/structure'
import {
  apiFindMock,
  cleanupTableTestWrappers,
  fetchCurrentPermissionMock,
  formatLocalDateTimeInput,
  loadGenericMock,
  mountAdditionalProjectionTestHost,
  mountBeforeInitialLoadTestHost,
  mountManualTestHost,
  mountQueryEnabledTestHost,
  mountTestHost,
  resetTableTestMocks,
  routeState,
} from './useSaplingTable.test-support'

describe('useSaplingTable filters and route state', () => {
  beforeEach(resetTableTestMocks)
  afterEach(cleanupTableTestWrappers)

  it('applies default open filters for chip references with isOpen values', async () => {
    loadGenericMock.mockResolvedValue(undefined)
    apiFindMock.mockImplementation((entityHandle: string) => {
      if (entityHandle === 'ticketStatus') {
        return Promise.resolve({
          data: [
            { handle: 'open', description: 'Open', isOpen: true },
            { handle: 'waiting', description: 'Waiting', isOpen: true },
            { handle: 'closed', description: 'Closed', isOpen: false },
          ],
          meta: { total: 3 },
        })
      }

      return Promise.resolve({
        data: [{ handle: 1, title: 'Open ticket' }],
        meta: { total: 1 },
      })
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
        relations: ['status', 'assigneePerson'],
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
