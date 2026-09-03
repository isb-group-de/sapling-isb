import { describe, expect, it } from 'vitest'
import type { WorkHourWeekItem } from '@/entity/entity'
import { resolveCalendarTimeGrid } from '../eventCalendarTimeGrid'

describe('eventCalendarTimeGrid', () => {
  it('keeps the complete day as the default range', () => {
    const workHours = {
      monday: { timeFrom: '08:00', timeTo: '17:00' },
    } as unknown as WorkHourWeekItem

    expect(resolveCalendarTimeGrid(workHours, 'fullDay')).toEqual({
      firstTime: 0,
      intervalCount: 24,
      startMinute: 0,
      endMinute: 1440,
    })
  })

  it('adds an hour before and after the configured working hours', () => {
    const workHours = {
      monday: { timeFrom: '08:00', timeTo: '17:00' },
      tuesday: { timeFrom: '09:00', timeTo: '16:00' },
    } as unknown as WorkHourWeekItem

    expect(resolveCalendarTimeGrid(workHours, 'workHours')).toEqual({
      firstTime: 420,
      intervalCount: 11,
      startMinute: 420,
      endMinute: 1080,
    })
  })

  it('rounds the visible end outward to a complete hourly interval', () => {
    const workHours = {
      monday: { timeFrom: '08:30', timeTo: '17:15' },
    } as unknown as WorkHourWeekItem

    expect(resolveCalendarTimeGrid(workHours, 'workHours')).toEqual({
      firstTime: 450,
      intervalCount: 11,
      startMinute: 450,
      endMinute: 1110,
    })
  })

  it('falls back to the full day when no valid working interval is configured', () => {
    const workHours = {
      monday: { timeFrom: '17:00', timeTo: '08:00' },
    } as unknown as WorkHourWeekItem

    expect(resolveCalendarTimeGrid(workHours, 'workHours')).toEqual({
      firstTime: 0,
      intervalCount: 24,
      startMinute: 0,
      endMinute: 1440,
    })
  })
})
