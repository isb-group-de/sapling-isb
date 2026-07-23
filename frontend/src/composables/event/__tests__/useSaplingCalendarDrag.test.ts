import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { EventStatusItem, EventTypeItem, PersonItem } from '@/entity/entity'
import type { CalendarDateItem } from '../eventDate.utils'
import type { SaplingCalendarEvent } from '../eventCalendar.utils'
import { useSaplingCalendarDrag } from '../useSaplingCalendarDrag'

function createTimeSlot(hour: number, minute = 0): CalendarDateItem {
  return {
    date: '2026-07-15',
    year: 2026,
    month: 7,
    day: 15,
    hour,
    minute,
  }
}

function createHarness() {
  const events = ref<SaplingCalendarEvent[]>([])
  const selectedPeople = ref([7, 9])
  const ownPerson = ref<PersonItem | null>({ handle: 5 } as PersonItem)
  const defaultEventType = ref<EventTypeItem | null>({
    handle: 'internal',
    title: 'Interne Tätigkeit',
  } as unknown as EventTypeItem)
  const defaultEventStatus = ref<EventStatusItem | null>({
    handle: 'scheduled',
    description: 'Geplant',
  } as unknown as EventStatusItem)
  const editEvent = ref<CalendarEvent | null>(null)
  const showEditDialog = ref(false)
  const forceEditDialogDirtyFields = ref<string[]>([])
  const openPersistedEventEditor = vi.fn(async () => undefined)
  const drag = useSaplingCalendarDrag({
    events,
    selectedPeople,
    ownPerson,
    defaultEventType,
    defaultEventStatus,
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

  it('leaves a pure click on an existing event to the normal click handler', () => {
    const harness = createHarness()
    const event = createPersistedEvent()

    harness.drag.startDrag(new Event('mousedown'), { event, timed: true })
    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9, 30))
    harness.drag.endDrag()

    expect(harness.openPersistedEventEditor).not.toHaveBeenCalled()
    expect(harness.drag.consumeSuppressedEventClick()).toBe(false)
  })

  it('creates a clean draft with the current person and selected participants', () => {
    const harness = createHarness()

    harness.drag.startTime(new Event('mousedown'), createTimeSlot(9))
    harness.drag.mouseMove(new Event('mousemove'), createTimeSlot(10))
    harness.drag.endDrag()

    expect(harness.events.value).toHaveLength(1)
    expect(harness.editEvent.value?.event?.participants).toEqual([5, 7, 9])
    expect(harness.editEvent.value?.event?.type).toEqual({
      handle: 'internal',
      title: 'Interne Tätigkeit',
    })
    expect(harness.editEvent.value?.event?.status).toEqual({
      handle: 'scheduled',
      description: 'Geplant',
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
})
