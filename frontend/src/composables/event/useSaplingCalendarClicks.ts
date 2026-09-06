import { onBeforeUnmount } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { CalendarDateItem } from './eventDate.utils'
import type { CalendarClickMode } from './eventCalendarPreferences'

// Only the conflicting single-click / double-click-drag combination needs a delay.
const DOUBLE_CLICK_WAIT = 350

export function useSaplingCalendarClicks(options: {
  openClickMode: () => CalendarClickMode
  createClickMode: () => CalendarClickMode
  dragClickMode: () => CalendarClickMode
  openEvent: (event: CalendarEvent) => void
  startDrag: (event: Event, payload: { event: CalendarEvent; timed: boolean }) => void
  startTime: (event: Event, slot: CalendarDateItem) => void
  mouseMove: (event: Event, slot: CalendarDateItem) => void
  endDrag: () => void
  cancelDrag: () => void
}) {
  let pendingClick: ReturnType<typeof setTimeout> | undefined
  let timeDown: { event: MouseEvent; slot: CalendarDateItem } | undefined
  let dragging = false
  let moved = false
  let eventOrigin: MouseEvent | undefined
  let pendingEvent: { event: CalendarEvent; timed: boolean } | undefined

  function clearClick() {
    clearTimeout(pendingClick)
    pendingClick = undefined
  }

  function matches(event: MouseEvent, mode: CalendarClickMode) {
    return mode === 'single' ? event.detail <= 1 : event.detail === 2
  }

  function activate(event: MouseEvent, mode: CalendarClickMode, action: () => void) {
    clearClick()
    if (!matches(event, mode)) {
      if (mode === 'single' && options.dragClickMode() === 'double' && event.detail === 2) action()
      return
    }
    if (mode === 'single' && options.dragClickMode() === 'double' && event.detail !== 0) {
      pendingClick = setTimeout(action, DOUBLE_CLICK_WAIT)
    } else {
      action()
    }
  }

  function eventClick(nativeEvent: MouseEvent, event: CalendarEvent) {
    if (moved) {
      moved = false
      return
    }
    activate(nativeEvent, options.openClickMode(), () => options.openEvent(event))
  }

  function eventDown(nativeEvent: MouseEvent, payload: { event: CalendarEvent; timed: boolean }) {
    clearClick()
    moved = false
    pendingEvent = undefined
    eventOrigin = nativeEvent
    if (nativeEvent.button !== 0 || !matches(nativeEvent, options.dragClickMode())) return
    pendingEvent = payload.timed ? payload : undefined
  }

  function timeMouseDown(nativeEvent: MouseEvent, slot: CalendarDateItem) {
    clearClick()
    if (nativeEvent.button !== 0) return
    if (pendingEvent) {
      timeDown = { event: nativeEvent, slot }
      return
    }
    // Event mouse-down bubbles to the grid even when dragging is disabled.
    if ((nativeEvent.target as Element | null)?.closest('.v-event, .v-event-timed')) return
    moved = false
    timeDown = { event: nativeEvent, slot }
  }

  function timeMouseMove(nativeEvent: MouseEvent, slot: CalendarDateItem) {
    if ((nativeEvent.buttons & 1) !== 1) return
    if (
      dragging &&
      eventOrigin &&
      Math.hypot(
        nativeEvent.clientX - eventOrigin.clientX,
        nativeEvent.clientY - eventOrigin.clientY,
      ) >= 4
    )
      moved = true
    if (timeDown && !dragging) {
      const distance = Math.hypot(
        nativeEvent.clientX - timeDown.event.clientX,
        nativeEvent.clientY - timeDown.event.clientY,
      )
      if (distance < 4) return
      moved = true
      if (!matches(timeDown.event, options.dragClickMode())) return
      if (pendingEvent) options.startDrag(timeDown.event, pendingEvent)
      options.startTime(timeDown.event, timeDown.slot)
      dragging = true
    }
    if (dragging) options.mouseMove(nativeEvent, slot)
  }

  function timeMouseUp(nativeEvent: MouseEvent) {
    if (nativeEvent.button !== 0) return
    if (dragging) {
      options.endDrag()
    } else if (timeDown && !moved && !pendingEvent) {
      const down = timeDown
      activate(down.event, options.createClickMode(), () => {
        options.startTime(down.event, down.slot)
        options.endDrag()
      })
    }
    dragging = false
    eventOrigin = undefined
    timeDown = undefined
    pendingEvent = undefined
  }

  function beginResize(nativeEvent: MouseEvent, resize: () => void) {
    clearClick()
    moved = false
    if (nativeEvent.button !== 0 || !matches(nativeEvent, options.dragClickMode())) return
    dragging = true
    eventOrigin = nativeEvent
    resize()
  }

  function cancel() {
    clearClick()
    timeDown = undefined
    pendingEvent = undefined
    if (dragging) options.cancelDrag()
    dragging = false
    eventOrigin = undefined
  }

  onBeforeUnmount(cancel)
  return { eventClick, eventDown, timeMouseDown, timeMouseMove, timeMouseUp, beginResize, cancel }
}
