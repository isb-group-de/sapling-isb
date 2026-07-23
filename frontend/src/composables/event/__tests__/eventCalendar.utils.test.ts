import { describe, expect, it } from 'vitest'

import {
  getCalendarEventOnlineMeetingUrl,
  getCalendarInteractionForcedDirtyFields,
  normalizeOnlineMeetingUrl,
} from '../eventCalendar.utils'

describe('getCalendarInteractionForcedDirtyFields', () => {
  it('keeps a newly opened draft clean until a dialog field changes', () => {
    expect(
      getCalendarInteractionForcedDirtyFields({
        isNewDraft: true,
        wasDragged: false,
        wasResized: false,
      }),
    ).toEqual([])
  })

  it('marks moved existing events as date changes', () => {
    expect(
      getCalendarInteractionForcedDirtyFields({
        isNewDraft: false,
        wasDragged: true,
        wasResized: false,
      }),
    ).toEqual(['startDate', 'endDate'])
  })

  it('marks resized existing events as an end date change', () => {
    expect(
      getCalendarInteractionForcedDirtyFields({
        isNewDraft: false,
        wasDragged: false,
        wasResized: true,
      }),
    ).toEqual(['endDate'])
  })

  it('normalizes safe online meeting URLs and rejects unsafe schemes', () => {
    expect(normalizeOnlineMeetingUrl(' https://teams.example.test/join ')).toBe(
      'https://teams.example.test/join',
    )
    expect(normalizeOnlineMeetingUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeOnlineMeetingUrl('not a url')).toBeNull()
  })

  it('reads the online meeting URL from a calendar event record', () => {
    expect(
      getCalendarEventOnlineMeetingUrl({
        start: 1,
        end: 2,
        event: { onlineMeetingURL: 'https://teams.example.test/join' },
      }),
    ).toBe('https://teams.example.test/join')
  })
})
