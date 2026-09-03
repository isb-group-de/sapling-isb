import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_EVENT_CALENDAR_PREFERENCES,
  loadEventCalendarPreferences,
  resolveCalendarIntervalHeight,
  saveEventCalendarPreferences,
} from '../eventCalendarPreferences'

describe('eventCalendarPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses the calendar defaults when no preference is stored', () => {
    expect(loadEventCalendarPreferences()).toEqual(DEFAULT_EVENT_CALENDAR_PREFERENCES)
  })

  it('stores and restores the supported calendar preferences', () => {
    const preferences = {
      calendarType: 'day' as const,
      calendarViewMode: 'sidebyside' as const,
      calendarMode: 'extended' as const,
      eventOverlapMode: 'column' as const,
      linkedScrolling: false,
      timeGridScale: 'double' as const,
      timeRangeMode: 'workHours' as const,
    }

    saveEventCalendarPreferences(preferences)

    expect(loadEventCalendarPreferences()).toEqual(preferences)
  })

  it('keeps valid values and replaces unsupported stored values with defaults', () => {
    window.localStorage.setItem(
      'sapling.calendar.preferences',
      JSON.stringify({
        calendarType: 'week',
        calendarViewMode: 'tiles',
        calendarMode: 'extended',
        eventOverlapMode: 'cover',
        linkedScrolling: 'yes',
        timeGridScale: 'large',
        timeRangeMode: 'office',
      }),
    )

    expect(loadEventCalendarPreferences()).toEqual({
      ...DEFAULT_EVENT_CALENDAR_PREFERENCES,
      calendarType: 'week',
      calendarMode: 'extended',
    })
  })

  it('falls back safely when the stored value is not valid JSON', () => {
    window.localStorage.setItem('sapling.calendar.preferences', '{broken')

    expect(loadEventCalendarPreferences()).toEqual(DEFAULT_EVENT_CALENDAR_PREFERENCES)
  })

  it('maps the supported time-grid scales to the existing and doubled interval height', () => {
    expect(resolveCalendarIntervalHeight('standard')).toBe(48)
    expect(resolveCalendarIntervalHeight('double')).toBe(96)
  })
})
