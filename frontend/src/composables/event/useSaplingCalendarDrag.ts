import { computed, ref, type Ref } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { EventCategoryItem, EventStatusItem, EventTypeItem, PersonItem } from '@/entity/entity'
import { roundTime, toTime, type CalendarDateItem } from '@/composables/event/eventDate.utils'
import {
  DEFAULT_EVENT_COLOR,
  DEFAULT_HOLIDAY_COLOR,
  buildDraftEventPayload,
  getCalendarEventHandle,
  getCalendarInteractionForcedDirtyFields,
  isHolidayCalendarEvent,
  isReadonlyCalendarEvent,
  type SaplingCalendarEvent,
} from '@/composables/event/eventCalendar.utils'
import { isRecurringCalendarEvent } from '@/utils/eventRecurrence'

interface UseSaplingCalendarDragOptions {
  events: Ref<SaplingCalendarEvent[]>
  selectedPeople: Ref<number[]>
  ownPerson: Ref<PersonItem | null>
  defaultEventType: Ref<EventTypeItem | null>
  defaultEventStatus: Ref<EventStatusItem | null>
  defaultEventCategory: Ref<EventCategoryItem | null>
  editEvent: Ref<CalendarEvent | null>
  showEditDialog: Ref<boolean>
  forceEditDialogDirtyFields: Ref<string[]>
  openPersistedEventEditor: (event: CalendarEvent, forcedDirtyFields: string[]) => Promise<void>
}

interface CalendarDragSnapshot {
  target: CalendarEvent
  start: number
  end: number
  event: CalendarEvent['event'] | undefined
}

/**
 * Owns the pointer interaction state for timed calendar events.
 *
 * The caller supplies only calendar/dialog state and the persisted-editor
 * callback. This keeps drag, resize, draft creation, click suppression, and
 * rollback behavior reusable without coupling it to loading or persistence.
 */
export function useSaplingCalendarDrag(options: UseSaplingCalendarDragOptions) {
  const dragEvent = ref<CalendarEvent | null>(null)
  const dragTime = ref<number | null>(null)
  const createEvent = ref<CalendarEvent | null>(null)
  const createStart = ref<number | null>(null)
  const extendOriginal = ref<number | null>(null)
  const suppressNextEventClick = ref(false)
  const dragSnapshots = ref<CalendarDragSnapshot[]>([])

  const isCalendarDragActive = computed(
    () => dragEvent.value != null || createEvent.value != null || extendOriginal.value != null,
  )

  function startDrag(
    _nativeEvent: Event,
    { event, timed }: { event: CalendarEvent; timed: boolean },
  ) {
    if (!event || !timed || isReadonlyCalendarEvent(event)) {
      return
    }

    dragEvent.value = event
    dragTime.value = null
    extendOriginal.value = null
    captureDragSnapshot(event)
  }

  function startTime(_nativeEvent: Event, timeSlot: CalendarDateItem) {
    const mouseTime = toTime(timeSlot)

    if (dragEvent.value && dragTime.value === null) {
      dragTime.value = mouseTime - dragEvent.value.start
      return
    }

    createStart.value = roundTime(mouseTime)
    createEvent.value = {
      color: DEFAULT_EVENT_COLOR,
      start: createStart.value,
      end: createStart.value,
      timed: true,
      event: {
        participants: [...options.selectedPeople.value],
      },
    }
    options.events.value.push(createEvent.value)
  }

  function extendBottom(event: CalendarEvent) {
    if (isReadonlyCalendarEvent(event)) {
      return
    }

    createEvent.value = event
    createStart.value = event.start
    extendOriginal.value = event.end
    captureDragSnapshot(event)
  }

  function mouseMove(_nativeEvent: Event, timeSlot: CalendarDateItem) {
    const mouseTime = toTime(timeSlot)

    if (dragEvent.value && dragTime.value !== null) {
      const draggedSnapshot = findDragSnapshot(dragEvent.value)
      const duration =
        (draggedSnapshot?.end ?? dragEvent.value.end) -
        (draggedSnapshot?.start ?? dragEvent.value.start)
      const newStart = roundTime(mouseTime - dragTime.value)
      const startDelta = newStart - (draggedSnapshot?.start ?? dragEvent.value.start)
      applySeriesMove(startDelta)
      dragEvent.value.end = newStart + duration
      return
    }

    if (!createEvent.value || createStart.value === null) {
      return
    }

    const mouseRounded = roundTime(mouseTime, false)
    createEvent.value.start = Math.min(mouseRounded, createStart.value)
    createEvent.value.end = Math.max(mouseRounded, createStart.value)

    if (extendOriginal.value != null) {
      applySeriesResize(createEvent.value.end - extendOriginal.value)
    }
  }

  function endDrag() {
    const isNewDraft =
      createEvent.value != null &&
      getCalendarEventHandle(createEvent.value) == null &&
      extendOriginal.value == null
    const wasDragged =
      dragEvent.value != null &&
      dragTime.value != null &&
      findDragSnapshot(dragEvent.value) != null &&
      (dragEvent.value.start !== findDragSnapshot(dragEvent.value)?.start ||
        dragEvent.value.end !== findDragSnapshot(dragEvent.value)?.end)
    const wasResized =
      extendOriginal.value != null &&
      createEvent.value != null &&
      createEvent.value.end !== extendOriginal.value

    if (isNewDraft) {
      const draftEvent = createEvent.value!
      options.editEvent.value = draftEvent
      draftEvent.event = buildDraftEventPayload(
        draftEvent,
        options.ownPerson.value,
        options.selectedPeople.value,
        options.defaultEventType.value,
        options.defaultEventStatus.value,
        options.defaultEventCategory.value,
      )
      options.forceEditDialogDirtyFields.value = getCalendarInteractionForcedDirtyFields({
        isNewDraft,
        wasDragged,
        wasResized,
      })
      options.showEditDialog.value = true
      suppressNextEventClick.value = true
    } else if (wasDragged || wasResized) {
      const draggedEvent = dragEvent.value ?? createEvent.value
      const forcedDirtyFields = getCalendarInteractionForcedDirtyFields({
        isNewDraft,
        wasDragged,
        wasResized,
      })
      if (draggedEvent) {
        void options.openPersistedEventEditor(draggedEvent, forcedDirtyFields)
      }
      suppressNextEventClick.value = true
    }

    resetPointerState()
  }

  function consumeSuppressedEventClick(): boolean {
    if (!suppressNextEventClick.value) {
      return false
    }

    suppressNextEventClick.value = false
    return true
  }

  function captureDragSnapshot(target: CalendarEvent) {
    const targets = isRecurringCalendarEvent(target)
      ? options.events.value.filter(
          (candidate) =>
            isRecurringCalendarEvent(candidate) &&
            getCalendarEventHandle(candidate) === getCalendarEventHandle(target),
        )
      : [target]

    dragSnapshots.value = targets.map((candidate) => ({
      target: candidate,
      start: candidate.start,
      end: candidate.end,
      event: candidate.event,
    }))
  }

  function restoreDragSnapshot() {
    if (dragSnapshots.value.length === 0) {
      return
    }

    dragSnapshots.value.forEach((snapshot) => {
      snapshot.target.start = snapshot.start
      snapshot.target.end = snapshot.end
      snapshot.target.event = snapshot.event
    })
    dragSnapshots.value = []
  }

  function cancelDrag() {
    if (createEvent.value) {
      if (extendOriginal.value != null) {
        createEvent.value.end = extendOriginal.value
      } else {
        const index = options.events.value.indexOf(createEvent.value)
        if (index !== -1) {
          options.events.value.splice(index, 1)
        }
      }
    }

    resetPointerState()
  }

  function getEventColor(event: CalendarEvent): string {
    const fallbackColor = isHolidayCalendarEvent(event)
      ? DEFAULT_HOLIDAY_COLOR
      : DEFAULT_EVENT_COLOR
    const color =
      typeof event.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(event.color)
        ? event.color
        : fallbackColor.toLowerCase()

    if (event !== dragEvent.value && event !== createEvent.value) {
      return color
    }

    const rgb = Number.parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = rgb & 0xff
    return `rgba(${r}, ${g}, ${b}, 0.7)`
  }

  function resetPointerState() {
    dragTime.value = null
    dragEvent.value = null
    createEvent.value = null
    createStart.value = null
    extendOriginal.value = null
  }

  function clearCreatedEvent() {
    createEvent.value = null
  }

  function clearDragSnapshot() {
    dragSnapshots.value = []
  }

  function resetDialogInteractionState() {
    clearDragSnapshot()
    suppressNextEventClick.value = false
  }

  function findDragSnapshot(target: CalendarEvent): CalendarDragSnapshot | undefined {
    return dragSnapshots.value.find((snapshot) => snapshot.target === target)
  }

  function applySeriesMove(startDelta: number) {
    const snapshots = dragSnapshots.value
    if (snapshots.length === 0) {
      return
    }

    snapshots.forEach((snapshot) => {
      snapshot.target.start = snapshot.start + startDelta
      snapshot.target.end = snapshot.end + startDelta
    })
  }

  function applySeriesResize(endDelta: number) {
    if (!createEvent.value || !isRecurringCalendarEvent(createEvent.value)) {
      return
    }

    dragSnapshots.value.forEach((snapshot) => {
      snapshot.target.end = snapshot.end + endDelta
    })
  }

  return {
    clearCreatedEvent,
    clearDragSnapshot,
    consumeSuppressedEventClick,
    createEvent,
    cancelDrag,
    endDrag,
    extendBottom,
    getEventColor,
    isCalendarDragActive,
    mouseMove,
    resetDialogInteractionState,
    restoreDragSnapshot,
    startDrag,
    startTime,
  }
}
