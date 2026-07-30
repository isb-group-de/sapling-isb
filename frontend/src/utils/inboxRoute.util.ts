import type {
  EffortEstimateItem,
  EventItem,
  InboxNotificationItem,
  InternalCaseItem,
  SalesOpportunityItem,
  TicketItem,
} from '@/entity/entity'
import type { RouteLocationRaw } from 'vue-router'

function getRecordInboxRoute(
  entityHandle: string,
  recordHandle: string | number | null | undefined,
): RouteLocationRaw {
  if (recordHandle == null || String(recordHandle).trim().length === 0) {
    return {
      path: `/table/${entityHandle}`,
    }
  }

  return {
    path: `/table/${entityHandle}`,
    query: {
      filter: JSON.stringify({ handle: recordHandle }),
      open: String(recordHandle),
    },
  }
}

function getEventCalendarRoute(recordHandle: string | number | null | undefined): RouteLocationRaw {
  if (recordHandle == null || String(recordHandle).trim().length === 0) {
    return {
      path: '/event',
    }
  }

  return {
    path: '/event',
    query: {
      open: String(recordHandle),
    },
  }
}

export function getTicketInboxRoute(ticket: TicketItem): RouteLocationRaw {
  return getRecordInboxRoute('ticket', ticket.handle)
}

export function getTaskInboxRoute(task: EventItem): RouteLocationRaw {
  return getEventCalendarRoute(task.handle)
}

export function getSalesOpportunityInboxRoute(opportunity: SalesOpportunityItem): RouteLocationRaw {
  return getRecordInboxRoute('salesOpportunity', opportunity.handle)
}

export function getEffortEstimateInboxRoute(estimate: EffortEstimateItem): RouteLocationRaw {
  return getRecordInboxRoute('effortEstimate', estimate.handle)
}

export function getInternalCaseInboxRoute(internalCase: InternalCaseItem): RouteLocationRaw {
  return getRecordInboxRoute('internalCase', internalCase.handle)
}

export function getNotificationInboxRoute(notification: InboxNotificationItem): RouteLocationRaw {
  const entityHandle =
    typeof notification.entity === 'object'
      ? String(notification.entity.handle ?? '').trim()
      : String(notification.entity ?? '').trim()
  const referenceHandle = notification.referenceHandle?.trim()

  if (entityHandle && referenceHandle) {
    return entityHandle === 'event'
      ? getEventCalendarRoute(referenceHandle)
      : getRecordInboxRoute(entityHandle, referenceHandle)
  }

  return getRecordInboxRoute('inboxNotification', notification.handle)
}
