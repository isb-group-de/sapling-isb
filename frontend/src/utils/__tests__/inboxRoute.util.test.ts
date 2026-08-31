import { describe, expect, it } from 'vitest'
import type {
  EffortEstimateItem,
  EventItem,
  InboxNotificationItem,
  InternalCaseItem,
  SalesOpportunityItem,
  TicketItem,
} from '@/entity/entity'
import {
  getEffortEstimateInboxRoute,
  getInternalCaseInboxRoute,
  getNotificationInboxRoute,
  getSalesOpportunityInboxRoute,
  getTaskInboxRoute,
  getTicketInboxRoute,
} from '@/utils/inboxRoute.util'

describe('inboxRoute.util', () => {
  it('opens partner work entries in the partner workspace and events in the calendar', () => {
    expect(getTicketInboxRoute({ handle: 12 } as TicketItem)).toEqual({
      path: '/partner/ticket',
      query: {
        filter: JSON.stringify({ handle: 12 }),
        open: '12',
      },
    })
    expect(getTaskInboxRoute({ handle: 23 } as EventItem)).toEqual({
      path: '/event',
      query: {
        open: '23',
      },
    })
    expect(getSalesOpportunityInboxRoute({ handle: 34 } as SalesOpportunityItem)).toEqual({
      path: '/partner/salesOpportunity',
      query: {
        filter: JSON.stringify({ handle: 34 }),
        open: '34',
      },
    })
    expect(getEffortEstimateInboxRoute({ handle: 45 } as EffortEstimateItem)).toEqual({
      path: '/partner/effortEstimate',
      query: {
        filter: JSON.stringify({ handle: 45 }),
        open: '45',
      },
    })
    expect(getInternalCaseInboxRoute({ handle: 56 } as InternalCaseItem)).toEqual({
      path: '/partner/internalCase',
      query: {
        filter: JSON.stringify({ handle: 56 }),
        open: '56',
      },
    })
  })

  it('links a recurring task to its first still-generated occurrence', () => {
    expect(
      getTaskInboxRoute({
        handle: 23,
        title: 'Daily review',
        startDate: new Date('2026-08-27T09:00:00.000Z'),
        endDate: new Date('2026-08-27T10:00:00.000Z'),
        recurrenceRule: 'FREQ=DAILY;COUNT=3',
        recurrenceExceptionDates: ['2026-08-27T09:00:00.000Z'],
      } as EventItem),
    ).toEqual({
      path: '/event',
      query: {
        open: '23',
        occurrence: '2026-08-28T09:00:00.000Z',
      },
    })
  })

  it.each(['ticket', 'salesOpportunity', 'effortEstimate', 'internalCase'])(
    'opens %s inbox notification references in the partner workspace',
    (entityHandle) => {
      expect(
        getNotificationInboxRoute({
          handle: 9,
          entity: { handle: entityHandle },
          referenceHandle: '12',
        } as InboxNotificationItem),
      ).toEqual({
        path: `/partner/${entityHandle}`,
        query: {
          filter: JSON.stringify({ handle: '12' }),
          open: '12',
        },
      })
    },
  )

  it('keeps notifications for other entities on the generic table workspace', () => {
    expect(
      getNotificationInboxRoute({
        handle: 9,
        entity: { handle: 'company' },
        referenceHandle: '12',
      } as InboxNotificationItem),
    ).toEqual({
      path: '/table/company',
      query: {
        filter: JSON.stringify({ handle: '12' }),
        open: '12',
      },
    })
  })

  it('opens event notifications in the calendar and selects the referenced event', () => {
    expect(
      getNotificationInboxRoute({
        handle: 9,
        entity: { handle: 'event' },
        referenceHandle: '23',
      } as InboxNotificationItem),
    ).toEqual({
      path: '/event',
      query: {
        open: '23',
      },
    })
  })

  it('falls back to opening the inbox notification record when no target reference exists', () => {
    expect(
      getNotificationInboxRoute({
        handle: 9,
        entity: { handle: 'ticket' },
        referenceHandle: null,
      } as InboxNotificationItem),
    ).toEqual({
      path: '/table/inboxNotification',
      query: {
        filter: JSON.stringify({ handle: 9 }),
        open: '9',
      },
    })
  })
})
