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
  it('opens actionable inbox entries in their filtered table dialog', () => {
    expect(getTicketInboxRoute({ handle: 12 } as TicketItem)).toEqual({
      path: '/table/ticket',
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
      path: '/table/salesOpportunity',
      query: {
        filter: JSON.stringify({ handle: 34 }),
        open: '34',
      },
    })
    expect(getEffortEstimateInboxRoute({ handle: 45 } as EffortEstimateItem)).toEqual({
      path: '/table/effortEstimate',
      query: {
        filter: JSON.stringify({ handle: 45 }),
        open: '45',
      },
    })
    expect(getInternalCaseInboxRoute({ handle: 56 } as InternalCaseItem)).toEqual({
      path: '/table/internalCase',
      query: {
        filter: JSON.stringify({ handle: 56 }),
        open: '56',
      },
    })
  })

  it('opens inbox notification references through their dedicated record route', () => {
    expect(
      getNotificationInboxRoute({
        handle: 9,
        entity: { handle: 'ticket' },
        referenceHandle: '12',
      } as InboxNotificationItem),
    ).toEqual({
      path: '/table/ticket',
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
