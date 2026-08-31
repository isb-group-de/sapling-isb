import type { OpenTaskSnapshot } from '@/composables/system/useOpenTaskCountEvents'
import type { SaplingNotificationPreferences } from '@/services/notification-preferences.service'
import { getOpenTaskEventOccurrence } from '@/utils/openTaskEvent'

export interface SaplingHeaderBadgeCounts {
  inboxCount: number
  inboxNotificationCount: number
}

function isDueByEndOfToday(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) {
    return false
  }

  const date = typeof value === 'string' ? new Date(value) : value
  if (!Number.isFinite(date.getTime())) {
    return false
  }

  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return date < tomorrowStart
}

export function getSaplingHeaderBadgeCounts(
  snapshot: OpenTaskSnapshot,
  preferences: SaplingNotificationPreferences,
  now = new Date(),
): SaplingHeaderBadgeCounts {
  const dueOpenTaskCount = [
    ...snapshot.tickets.map((ticket) => ticket.deadlineDate),
    ...snapshot.tasks.map((task) => getOpenTaskEventOccurrence(task)?.startDate),
    ...snapshot.salesOpportunities.map((opportunity) => opportunity.closeDate),
    ...(snapshot.effortEstimates ?? []).map((estimate) => estimate.expectedCompletionDate),
  ].filter((date) => isDueByEndOfToday(date, now)).length
  const notificationCount = snapshot.notifications.length

  return {
    inboxCount: preferences.badgeChannelEnabled
      ? (preferences.openTaskNotificationsEnabled ? dueOpenTaskCount : 0) +
        (preferences.inboxNotificationsEnabled ? notificationCount : 0)
      : 0,
    inboxNotificationCount:
      preferences.badgeChannelEnabled && preferences.inboxNotificationsEnabled
        ? notificationCount
        : 0,
  }
}
