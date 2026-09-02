export type CalendarType = 'workweek' | 'month' | 'day' | 'week'
export type CalendarViewMode = 'single' | 'sidebyside'
export type CalendarMode = 'default' | 'extended'
export type CalendarEventOverlapMode = 'stack' | 'column'
export type CalendarSyncProvider = 'azure' | 'google'

export const TOOLBAR_VIEW_INLINE_MIN_WIDTH = 2450
export const TOOLBAR_MODE_INLINE_MIN_WIDTH = 2100
export const TOOLBAR_ARRANGEMENT_INLINE_MIN_WIDTH = 1750
export const TOOLBAR_DATA_ACTIONS_INLINE_MIN_WIDTH = 1300
export const TOOLBAR_TYPE_INLINE_MIN_WIDTH = 900
export const TOOLBAR_COMPACT_NAVIGATION_MAX_WIDTH = 1550

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value)
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
  }

  return null
}

export function resolvePickerDate(input: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!match) {
    const parsedDate = new Date(input)
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
