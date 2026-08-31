import { describe, expect, it } from 'vitest'
import type {
  EffortEstimateItem,
  EventItem,
  InboxNotificationItem,
  InternalCaseItem,
  SalesOpportunityItem,
  TicketItem,
} from '@/entity/entity'
import type { OpenTaskSnapshot } from '@/composables/system/useOpenTaskCountEvents'
import type { SaplingNotificationPreferences } from '@/services/notification-preferences.service'
import { getSaplingHeaderBadgeCounts } from './saplingHeaderBadge.utils'

function createSnapshot(): OpenTaskSnapshot {
  return {
    count: 12,
    tickets: [
      { deadlineDate: new Date(2026, 7, 27, 12) },
      { deadlineDate: new Date(2026, 7, 28, 18) },
      { deadlineDate: new Date(2026, 7, 29, 0) },
    ] as TicketItem[],
    tasks: [
      { startDate: new Date(2026, 7, 28, 9) },
      { startDate: new Date(2026, 8, 4, 9) },
    ] as EventItem[],
    salesOpportunities: [
      { closeDate: new Date(2026, 7, 20) },
      { closeDate: null },
    ] as SalesOpportunityItem[],
    effortEstimates: [
      { expectedCompletionDate: new Date(2026, 7, 28, 23, 59) },
      { expectedCompletionDate: new Date(2026, 8, 15) },
    ] as EffortEstimateItem[],
    internalCases: [{ createdAt: new Date(2026, 7, 1) }] as InternalCaseItem[],
    notifications: [{ handle: 1 }, { handle: 2 }] as InboxNotificationItem[],
  }
}

const enabledPreferences: SaplingNotificationPreferences = {
  badgeChannelEnabled: true,
  previewChannelEnabled: true,
  openTaskNotificationsEnabled: true,
  inboxNotificationsEnabled: true,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '07:00',
}

describe('getSaplingHeaderBadgeCounts', () => {
  it('counts inbox notifications plus overdue and today open tasks', () => {
    expect(
      getSaplingHeaderBadgeCounts(createSnapshot(), enabledPreferences, new Date(2026, 7, 28, 10)),
    ).toEqual({
      inboxCount: 7,
      inboxNotificationCount: 2,
    })
  })

  it('respects the badge and notification category preferences', () => {
    const snapshot = createSnapshot()
    const now = new Date(2026, 7, 28, 10)

    expect(
      getSaplingHeaderBadgeCounts(
        snapshot,
        { ...enabledPreferences, openTaskNotificationsEnabled: false },
        now,
      ).inboxCount,
    ).toBe(2)
    expect(
      getSaplingHeaderBadgeCounts(
        snapshot,
        { ...enabledPreferences, inboxNotificationsEnabled: false },
        now,
      ),
    ).toEqual({
      inboxCount: 5,
      inboxNotificationCount: 0,
    })
    expect(
      getSaplingHeaderBadgeCounts(
        snapshot,
        { ...enabledPreferences, badgeChannelEnabled: false },
        now,
      ),
    ).toEqual({
      inboxCount: 0,
      inboxNotificationCount: 0,
    })
  })

  it('uses the first still-generated recurrence instead of the series start', () => {
    const snapshot = createSnapshot()
    snapshot.tasks = [
      {
        startDate: new Date('2026-08-20T09:00:00.000Z'),
        endDate: new Date('2026-08-20T10:00:00.000Z'),
        recurrenceRule: 'FREQ=WEEKLY;COUNT=3',
        recurrenceExceptionDates: ['2026-08-20T09:00:00.000Z', '2026-08-27T09:00:00.000Z'],
      } as EventItem,
    ]

    expect(
      getSaplingHeaderBadgeCounts(snapshot, enabledPreferences, new Date(2026, 7, 28, 10)),
    ).toEqual({
      inboxCount: 6,
      inboxNotificationCount: 2,
    })
  })
})
