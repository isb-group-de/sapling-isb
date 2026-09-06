import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { EventCategoryItem, EventStatusItem, EventTypeItem, PersonItem } from '@/entity/entity'
import type { CalendarDateItem } from '../eventDate.utils'
import type { SaplingCalendarEvent } from '../eventCalendar.utils'
import { useSaplingCalendarDrag } from '../useSaplingCalendarDrag'

function createTimeSlot(hour: number, minute = 0, day = 15): CalendarDateItem {
  return {
    date: `2026-07-${String(day).padStart(2, '0')}`,
    year: 2026,
    month: 7,
    day,
    hour,
    minute,
  }
}

function createHarness() {
  const events = ref<SaplingCalendarEvent[]>([])
  const selectedPeople = ref([7, 9])
  const ownPerson = ref<PersonItem | null>({ handle: 5 } as PersonItem)
  const peopleMap = ref<Record<number, PersonItem>>({
    7: { handle: 7, firstName: 'Ada', lastName: 'Lovelace' } as PersonItem,
    9: { handle: 9, firstName: 'Grace', lastName: 'Hopper' } as PersonItem,
  })
  const defaultEventType = ref<EventTypeItem | null>({
    handle: 'online',
    title: 'Online',
  } as unknown as EventTypeItem)
  const defaultEventStatus = ref<EventStatusItem | null>({
    handle: 'scheduled',
    description: 'Geplant',
  } as unknown as EventStatusItem)
  const defaultEventCategory = ref<EventCategoryItem | null>({
    handle: 'internal',
    title: 'Intern',
  } as EventCategoryItem)
  const editEvent = ref<CalendarEvent | null>(null)
  const showEditDialog = ref(false)
  const forceEditDialogDirtyFields = ref<string[]>([])
  const openPersistedEventEditor = vi.fn(async () => undefined)
  const drag = useSaplingCalendarDrag({
    events,
    selectedPeople,
    peopleMap,
    ownPerson,
    defaultEventType,
    defaultEventStatus,
    defaultEventCategory,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    openPersistedEventEditor,
  })

  return {
    drag,
    editEvent,
    events,
    forceEditDialogDirtyFields,
    openPersistedEventEditor,
    showEditDialog,
  }
}

function createPersistedEvent(): CalendarEvent {
  return {
    start: new Date(2026, 6, 15, 9).getTime(),
    end: new Date(2026, 6, 15, 10).getTime(),
    timed: true,
    color: '#336699',
    event: { handle: 42 },
  }
}

function createRecurringOccurrence(day: number): SaplingCalendarEvent {
  const start = new Date(2026, 6, day, 9)
  const end = new Date(2026, 6, day, 10)
  return {
    start: start.getTime(),
    end: end.getTime(),
    timed: true,
    color: '#336699',
    event: {
      handle: 42,
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=2',
    },
    isRecurringOccurrence: true,
    recurrenceOccurrenceStart: start.toISOString(),
    recurrenceOccurrenceEnd: end.toISOString(),
    recurrenceSeriesHandle: 42,
  } as unknown as SaplingCalendarEvent
}

describe('useSaplingCalendarDrag', () => {
  it('moves persisted events, opens them dirty, and can restore the snapshot', () => {
    const harness = createHarness()
    const event = createPersistedEvent()
    const originalStart = event.start
    const originalEnd = event.end

    harness.drag.startDrag(new Event('mousedown'), { event, timed: true })
    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9, 30))
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(11))
    harness.drag.endDrag()

    expect(event.start).toBe(new Date(2026, 6, 15, 10, 30).getTime())
    expect(event.end).toBe(new Date(2026, 6, 15, 11, 30).getTime())
    expect(harness.openPersistedEventEditor).toHaveBeenCalledWith(event, ['startDate', 'endDate'])
    expect(harness.drag.consumeSuppressedEventClick()).toBe(true)
    expect(harness.drag.consumeSuppressedEventClick()).toBe(false)

    harness.drag.restoreDragSnapshot()
    expect(event.start).toBe(originalStart)
    expect(event.end).toBe(originalEnd)
  })

  it('expires click suppression when mouseup had no following event click', async () => {
    const harness = createHarness()
    const event = createPersistedEvent()
    harness.events.value.push(event as SaplingCalendarEvent)
    harness.drag.startDrag(new Event('mousedown'), { event, timed: true })
    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9))
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(10))
    harness.drag.endDrag()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(harness.drag.consumeSuppressedEventClick()).toBe(false)
  })

  it('leaves a pure click on an existing event to the normal click handler', () => {
    const harness = createHarness()
    const event = createPersistedEvent()

    harness.drag.startDrag(new Event('mousedown'), { event, timed: true })
    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9, 30))
    harness.drag.endDrag()

    expect(harness.openPersistedEventEditor).not.toHaveBeenCalled()
    expect(harness.drag.consumeSuppressedEventClick()).toBe(false)
  })

  it('moves every rendered occurrence of a recurring series during drag', () => {
    const harness = createHarness()
    const firstOccurrence = createRecurringOccurrence(15)
    const secondOccurrence = createRecurringOccurrence(16)
    harness.events.value.push(firstOccurrence, secondOccurrence)

    harness.drag.startDrag(new Event('mousedown'), { event: secondOccurrence, timed: true })
    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9, 30))
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(11))

    expect(firstOccurrence.start).toBe(new Date(2026, 6, 15, 10, 30).getTime())
    expect(firstOccurrence.end).toBe(new Date(2026, 6, 15, 11, 30).getTime())
    expect(secondOccurrence.start).toBe(new Date(2026, 6, 16, 10, 30).getTime())
    expect(secondOccurrence.end).toBe(new Date(2026, 6, 16, 11, 30).getTime())

    harness.drag.endDrag()
    harness.drag.restoreDragSnapshot()

    expect(firstOccurrence.start).toBe(new Date(2026, 6, 15, 9).getTime())
    expect(secondOccurrence.start).toBe(new Date(2026, 6, 16, 9).getTime())
  })

  it('does not start dragging a derived buffer placeholder', () => {
    const harness = createHarness()
    const placeholder = {
      start: new Date(2026, 6, 15, 8).getTime(),
      end: new Date(2026, 6, 15, 9).getTime(),
      timed: true,
      saplingSource: 'eventBuffer',
      event: {
        bufferKind: 'preparation',
        parentEventHandle: 42,
        title: 'Vorbereitung: Planning',
        isAllDay: false,
      },
    } as CalendarEvent

    harness.drag.startDrag(new Event('mousedown'), { event: placeholder, timed: true })
    harness.drag.startTime(new Event('mousedown'), createTimeSlot(8))
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(10))
    harness.drag.endDrag()

    expect(placeholder.start).toBe(new Date(2026, 6, 15, 8).getTime())
    expect(placeholder.end).toBe(new Date(2026, 6, 15, 9).getTime())
    expect(harness.openPersistedEventEditor).not.toHaveBeenCalled()
  })

  it('creates a clean draft with only the selected participants', () => {
    const harness = createHarness()

    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9))
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(10))
    harness.drag.endDrag()

    expect(harness.events.value).toHaveLength(1)
    expect(harness.editEvent.value?.event?.participants).toEqual([
      { handle: 7, firstName: 'Ada', lastName: 'Lovelace' },
      { handle: 9, firstName: 'Grace', lastName: 'Hopper' },
    ])
    expect(harness.editEvent.value?.event?.type).toEqual({
      handle: 'online',
      title: 'Online',
    })
    expect(harness.editEvent.value?.event?.status).toEqual({
      handle: 'scheduled',
      description: 'Geplant',
    })
    expect(harness.editEvent.value?.event?.category).toEqual({
      handle: 'internal',
      title: 'Intern',
    })
    expect(harness.forceEditDialogDirtyFields.value).toEqual([])
    expect(harness.showEditDialog.value).toBe(true)
  })

  it('restores the original end time when resizing is cancelled', () => {
    const harness = createHarness()
    const event = createPersistedEvent()
    harness.events.value.push(event as SaplingCalendarEvent)

    harness.drag.extendBottom(event)
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(11))
    expect(event.end).toBe(new Date(2026, 6, 15, 11).getTime())

    harness.drag.cancelDrag()
    expect(event.end).toBe(new Date(2026, 6, 15, 10).getTime())
    expect(harness.drag.createEvent.value).toBeNull()
  })

  it('resizes every rendered occurrence of a recurring series', () => {
    const harness = createHarness()
    const firstOccurrence = createRecurringOccurrence(15)
    const secondOccurrence = createRecurringOccurrence(16)
    harness.events.value.push(firstOccurrence, secondOccurrence)

    harness.drag.extendBottom(secondOccurrence)
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(11, 0, 16))

    expect(firstOccurrence.end).toBe(new Date(2026, 6, 15, 11).getTime())
    expect(secondOccurrence.end).toBe(new Date(2026, 6, 16, 11).getTime())
  })
})
