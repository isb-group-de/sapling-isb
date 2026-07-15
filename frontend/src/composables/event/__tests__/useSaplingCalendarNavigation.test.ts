import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkHourWeekItem } from '@/entity/entity'
import { useSaplingCalendarNavigation } from '../useSaplingCalendarNavigation'

describe('useSaplingCalendarNavigation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves day, week, and month anchors by their logical units', () => {
    const calendarType = ref<'day' | 'workweek' | 'week' | 'month'>('day')
    const navigation = useSaplingCalendarNavigation(calendarType, ref(null))
    navigation.value.value = '2026-07-15'

    navigation.goToNext()
    expect(navigation.value.value).toBe('2026-07-16')

    calendarType.value = 'week'
    navigation.goToPrevious()
    expect(navigation.value.value).toBe('2026-07-06')

    calendarType.value = 'month'
    navigation.value.value = '2026-07-01'
    navigation.goToNext()
    expect(navigation.value.value).toBe('2026-08-01')
  })

  it('normalizes direct navigation to the active workweek anchor', () => {
    const calendarType = ref<'day' | 'workweek' | 'week' | 'month'>('workweek')
    const navigation = useSaplingCalendarNavigation(calendarType, ref(null))

    navigation.goToDate('2026-07-15')

    expect(navigation.value.value).toBe('2026-07-13')
  })

  it('projects configured work hours into a calendar overlay', () => {
    const workHours = ref({
      wednesday: { timeFrom: '08:00', timeTo: '16:00' },
    } as unknown as WorkHourWeekItem)
    const navigation = useSaplingCalendarNavigation(ref('week'), workHours)

    expect(navigation.getWorkHourStyle('2026-07-15')).toMatchObject({
      top: `${(8 / 24) * 100}%`,
      height: `${(8 / 24) * 100}%`,
      position: 'absolute',
      pointerEvents: 'none',
    })
  })
})
