import type { RouteLocationRaw } from 'vue-router'

export type InboxEntryKind =
  'ticket' | 'event' | 'salesOpportunity' | 'effortEstimate' | 'internalCase' | 'notification'
export type InboxSectionKey = 'overdue' | 'today' | 'upcoming' | 'later' | 'unplanned'

export interface InboxEntry {
  id: string
  kind: InboxEntryKind
  kindLabelKey:
    | 'navigation.ticket'
    | 'navigation.event'
    | 'navigation.salesOpportunity'
    | 'navigation.effortEstimate'
    | 'navigation.internalCase'
    | 'navigation.inboxNotification'
  title: string
  description: string
  dateText: string
  dateValue: Date | null
  icon: string
  accentColor?: string | null
  contextLabel?: string
  contextColor?: string | null
  statusLabel?: string
  statusColor?: string | null
  supportLabels: string[]
  route: RouteLocationRaw
  notificationHandle?: number | null
  dismissible?: boolean
}

export interface InboxSection {
  key: InboxSectionKey
  titleKey: 'inbox.overdue' | 'inbox.today' | 'inbox.upcoming' | 'inbox.later' | 'inbox.unplanned'
  subtitleKey:
    | 'inbox.overdueSummary'
    | 'inbox.todaySummary'
    | 'inbox.upcomingSummary'
    | 'inbox.laterSummary'
    | 'inbox.unplannedSummary'
  emptyKey:
    | 'inbox.overdueEmpty'
    | 'inbox.todayEmpty'
    | 'inbox.upcomingEmpty'
    | 'inbox.laterEmpty'
    | 'inbox.unplannedEmpty'
  icon: string
  tone: 'primary' | 'info' | 'warning' | 'success' | 'secondary'
  count: number
  items: InboxEntry[]
  empty: boolean
}

export interface InboxSummaryCard {
  key: 'effortEstimate' | 'ticket' | 'event' | 'salesOpportunity' | 'internalCase'
  labelKey:
    | 'navigation.effortEstimate'
    | 'navigation.ticket'
    | 'navigation.event'
    | 'navigation.salesOpportunity'
    | 'navigation.internalCase'
  icon: string
  count: number
  tone: 'primary' | 'warning' | 'info' | 'success'
}

const UPCOMING_DAY_RANGE = 7

export function toInboxDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const normalizedDate = typeof date === 'string' ? new Date(date) : date
  return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate
}

export function getInboxSectionKey(date: Date | null): InboxSectionKey {
  if (!date) return 'unplanned'
  const todayStart = startOfDay(new Date())
  const tomorrowStart = addDays(todayStart, 1)
  const upcomingEnd = addDays(tomorrowStart, UPCOMING_DAY_RANGE)
  if (date < todayStart) return 'overdue'
  if (date < tomorrowStart) return 'today'
  if (date < upcomingEnd) return 'upcoming'
  return 'later'
}

export function compareInboxEntriesByDate(left: InboxEntry, right: InboxEntry): number {
  const leftTime = left.dateValue?.getTime() ?? Number.MAX_SAFE_INTEGER
  const rightTime = right.dateValue?.getTime() ?? Number.MAX_SAFE_INTEGER
  return leftTime === rightTime ? left.title.localeCompare(right.title) : leftTime - rightTime
}

export function formatInboxCurrency(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatInboxProbability(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : ''
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}
