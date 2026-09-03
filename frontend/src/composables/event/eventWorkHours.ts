import type { PersonItem, WorkHourWeekItem } from '@/entity/entity'

const WORK_WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

/**
 * Resolves a usable, populated work week from person data before falling back
 * to the dedicated current-user endpoint. Generic person references can carry
 * only a work-week handle; those must not replace a fully populated fallback.
 */
export function resolvePersonWorkHours(
  person: PersonItem | null | undefined,
  fallback: WorkHourWeekItem | null = null,
): WorkHourWeekItem | null {
  return (
    asPopulatedWorkWeek(person?.workWeek) ??
    asPopulatedWorkWeek(person?.company && person.company.workWeek) ??
    asPopulatedWorkWeek(fallback)
  )
}

function asPopulatedWorkWeek(value: unknown): WorkHourWeekItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const workWeek = value as WorkHourWeekItem
  return WORK_WEEK_DAYS.some((day) => Object.prototype.hasOwnProperty.call(workWeek, day))
    ? workWeek
    : null
}
