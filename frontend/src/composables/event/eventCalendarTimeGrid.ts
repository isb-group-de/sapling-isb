import type { WorkHourWeekItem } from '@/entity/entity'
import type { CalendarTimeRangeMode } from './eventCalendarPreferences'

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR
const WORK_HOUR_BUFFER_MINUTES = MINUTES_PER_HOUR
const WORK_WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export interface CalendarTimeGrid {
  firstTime: number
  intervalCount: number
  startMinute: number
  endMinute: number
}

const FULL_DAY_TIME_GRID: CalendarTimeGrid = {
  firstTime: 0,
  intervalCount: 24,
  startMinute: 0,
  endMinute: MINUTES_PER_DAY,
}

export function resolveCalendarTimeGrid(
  workHours: WorkHourWeekItem | null,
  mode: CalendarTimeRangeMode,
): CalendarTimeGrid {
  if (mode === 'fullDay' || !workHours) {
    return { ...FULL_DAY_TIME_GRID }
  }

  const ranges = WORK_WEEK_DAYS.flatMap((day) => {
    const workHour = workHours[day]
    const fromMinute = parseTimeToMinutes(workHour?.timeFrom)
    const toMinute = parseTimeToMinutes(workHour?.timeTo)

    return fromMinute !== null && toMinute !== null && toMinute > fromMinute
      ? [{ fromMinute, toMinute }]
      : []
  })

  if (ranges.length === 0) {
    return { ...FULL_DAY_TIME_GRID }
  }

  const earliestStart = Math.min(...ranges.map((range) => range.fromMinute))
  const latestEnd = Math.max(...ranges.map((range) => range.toMinute))
  const startMinute = Math.max(0, earliestStart - WORK_HOUR_BUFFER_MINUTES)
  const requestedEndMinute = Math.min(MINUTES_PER_DAY, latestEnd + WORK_HOUR_BUFFER_MINUTES)
  const intervalCount = Math.ceil((requestedEndMinute - startMinute) / MINUTES_PER_HOUR)
  const endMinute = Math.min(MINUTES_PER_DAY, startMinute + intervalCount * MINUTES_PER_HOUR)

  return {
    firstTime: startMinute,
    intervalCount,
    startMinute,
    endMinute,
  }
}

function parseTimeToMinutes(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return hours * MINUTES_PER_HOUR + minutes
}
