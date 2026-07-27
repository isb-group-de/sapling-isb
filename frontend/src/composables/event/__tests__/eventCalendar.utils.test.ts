import { describe, expect, it } from 'vitest'
import type { EventItem } from '@/entity/entity'

import {
  addEventBufferPlaceholders,
  getCalendarEventOnlineMeetingUrl,
  getCalendarInteractionForcedDirtyFields,
  isBufferCalendarEvent,
  isReadonlyCalendarEvent,
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

  it('derives non-persisted preparation and follow-up placeholders from the main event', () => {
    const mainStart = new Date('2026-07-27T12:15:00.000Z').getTime()
    const mainEnd = new Date('2026-07-27T14:15:00.000Z').getTime()
    const [preparation, main, followUp] = addEventBufferPlaceholders(
      {
        start: mainStart,
        end: mainEnd,
        timed: true,
        saplingSource: 'event',
        event: {
          handle: 42,
          title: 'Test',
          preparationDuration: '01:00:00',
          followUpDuration: '00:30:00',
        } as EventItem,
      },
      { preparation: 'Vorbereitung', followUp: 'Nachbereitung' },
    )

    expect(preparation).toMatchObject({
      start: mainStart - 60 * 60_000,
      end: mainStart,
      saplingSource: 'eventBuffer',
      event: {
        bufferKind: 'preparation',
        parentEventHandle: 42,
        title: 'Vorbereitung: Test',
      },
    })
    expect(main.saplingSource).toBe('event')
    expect(followUp).toMatchObject({
      start: mainEnd,
      end: mainEnd + 30 * 60_000,
      saplingSource: 'eventBuffer',
      event: {
        bufferKind: 'followUp',
        parentEventHandle: 42,
        title: 'Nachbereitung: Test',
      },
    })
    expect(preparation.event?.handle).toBeUndefined()
    expect(followUp.event?.handle).toBeUndefined()
    expect(isBufferCalendarEvent(preparation)).toBe(true)
    expect(isReadonlyCalendarEvent(preparation)).toBe(true)
    expect(isReadonlyCalendarEvent(main)).toBe(false)
  })
})
