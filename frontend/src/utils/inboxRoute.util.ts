import type {
  EffortEstimateItem,
  EventItem,
  InboxNotificationItem,
  InternalCaseItem,
  SalesOpportunityItem,
  TicketItem,
} from '@/entity/entity'
import type { RouteLocationRaw } from 'vue-router'
import { getOpenTaskEventOccurrence } from '@/utils/openTaskEvent'

const PARTNER_INBOX_ENTITY_HANDLES = new Set([
  'effortEstimate',
  'internalCase',
  'salesOpportunity',
  'ticket',
])

function getRecordInboxRoute(
  entityHandle: string,
  recordHandle: string | number | null | undefined,
  workspace: 'partner' | 'table' = 'table',
): RouteLocationRaw {
  const path = `/${workspace}/${entityHandle}`

  if (recordHandle == null || String(recordHandle).trim().length === 0) {
    return {
      path,
    }
  }

  return {
    path,
    query: {
      filter: JSON.stringify({ handle: recordHandle }),
      open: String(recordHandle),
    },
  }
}

function getEventCalendarRoute(
  recordHandle: string | number | null | undefined,
  occurrenceStart?: string | null,
): RouteLocationRaw {
  if (recordHandle == null || String(recordHandle).trim().length === 0) {
    return {
      path: '/event',
    }
  }

  const query: Record<string, string> = {
    open: String(recordHandle),
  }
  if (occurrenceStart) {
    query.occurrence = occurrenceStart
  }

  return {
    path: '/event',
    query,
  }
}

export function getTicketInboxRoute(ticket: TicketItem): RouteLocationRaw {
  return getRecordInboxRoute('ticket', ticket.handle, 'partner')
}

export function getTaskInboxRoute(task: EventItem): RouteLocationRaw {
  const occurrence = getOpenTaskEventOccurrence(task)
  return getEventCalendarRoute(task.handle, occurrence?.recurrenceOccurrenceStart)
}

export function getSalesOpportunityInboxRoute(opportunity: SalesOpportunityItem): RouteLocationRaw {
  return getRecordInboxRoute('salesOpportunity', opportunity.handle, 'partner')
}

export function getEffortEstimateInboxRoute(estimate: EffortEstimateItem): RouteLocationRaw {
  return getRecordInboxRoute('effortEstimate', estimate.handle, 'partner')
}

export function getInternalCaseInboxRoute(internalCase: InternalCaseItem): RouteLocationRaw {
  return getRecordInboxRoute('internalCase', internalCase.handle, 'partner')
}

export function getNotificationInboxRoute(notification: InboxNotificationItem): RouteLocationRaw {
  const entityHandle =
    typeof notification.entity === 'object'
      ? String(notification.entity.handle ?? '').trim()
      : String(notification.entity ?? '').trim()
  const referenceHandle = notification.referenceHandle?.trim()

  if (entityHandle && referenceHandle) {
    if (entityHandle === 'systemAlertIncident') {
      return {
        path: '/system',
        query: { incident: referenceHandle },
      }
    }

    if (entityHandle === 'event') {
      return getEventCalendarRoute(referenceHandle)
    }

    return getRecordInboxRoute(
      entityHandle,
      referenceHandle,
      PARTNER_INBOX_ENTITY_HANDLES.has(entityHandle) ? 'partner' : 'table',
    )
  }

  return getRecordInboxRoute('inboxNotification', notification.handle)
}
