import {
  onBeforeUnmount,
  ref,
  type ComponentPublicInstance,
  type CSSProperties,
  type Ref,
} from 'vue'
import type { WorkHourWeekItem } from '@/entity/entity'
import {
  formatLocalDate,
  isValidDate,
  normalizeDateForCalendarType,
  parseLocalCalendarDate,
  type CalendarType,
} from './eventDate.utils'
import { getWorkHourForDate } from './eventCalendar.utils'

type CalendarScrollContainerRef = HTMLElement | ComponentPublicInstance | null

const CURRENT_TIME_SCROLL_RETRY_DELAY = 200
const CURRENT_TIME_SCROLL_MAX_ATTEMPTS = 5

/** Owns calendar date navigation, current-time scrolling, and work-hour overlays. */
export function useSaplingCalendarNavigation(
  calendarType: Ref<CalendarType>,
  workHours: Ref<WorkHourWeekItem | null>,
) {
  const value = ref(formatLocalDate(new Date()))
  const calendarScrollContainer = ref<CalendarScrollContainerRef>(null)
  let scrollTimeoutId: number | null = null

  onBeforeUnmount(() => {
    if (scrollTimeoutId !== null) {
      window.clearTimeout(scrollTimeoutId)
    }
  })

  function nowY() {
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    return `${(minutes / (24 * 60)) * 100}%`
  }

  function goToDate(target: Date | string) {
    const parsedDate =
      typeof target === 'string' ? parseLocalCalendarDate(target) : new Date(target)
    if (!isValidDate(parsedDate)) {
      return
    }

    const nextValue = formatLocalDate(normalizeDateForCalendarType(parsedDate, calendarType.value))
    if (value.value === nextValue) {
      queueScrollToCurrentTime(0)
      return
    }

    value.value = nextValue
  }

  function goToToday() {
    goToDate(new Date())
  }

  function goToPrevious() {
    shiftCalendar(-1)
  }

  function goToNext() {
    shiftCalendar(1)
  }

  function shiftCalendar(direction: 1 | -1) {
    const current = normalizeDateForCalendarType(
      value.value ? parseLocalCalendarDate(value.value) : new Date(),
      calendarType.value,
    )
    const nextDate = new Date(current)

    switch (calendarType.value) {
      case 'day':
        nextDate.setDate(current.getDate() + direction)
        break
      case 'workweek':
      case 'week':
        nextDate.setDate(current.getDate() + 7 * direction)
        break
      case 'month':
        nextDate.setMonth(current.getMonth() + direction)
        break
    }

    value.value = formatLocalDate(normalizeDateForCalendarType(nextDate, calendarType.value))
  }

  function scrollToCurrentTime(attempt = 0) {
    const outer =
      resolveScrollContainerElement(calendarScrollContainer.value) ||
      document.querySelector('.sapling-calendar-frame') ||
      document.querySelector('.calendar-card-text')
    if (!outer) {
      retryScrollToCurrentTime(attempt)
      return
    }

    const containers = Array.from(
      outer.querySelectorAll(
        '.v-calendar-daily__scroll-area, .v-calendar-weekly__scroll-area, .v-calendar-monthly__scroll-area',
      ),
    ) as HTMLElement[]
    const resolvedContainers = containers.length > 0 ? containers : [outer]
    let hasMarkers = false

    resolvedContainers.forEach((container) => {
      const markers = Array.from(container.querySelectorAll('.v-current-time')) as HTMLElement[]
      if (markers.length === 0 || container.scrollHeight <= container.clientHeight) {
        return
      }

      hasMarkers = true
      const targetOffset = resolveCurrentTimeScrollOffset(container, markers)
      if (targetOffset == null) {
        return
      }

      container.scrollTop = targetOffset
    })

    if (!hasMarkers) {
      retryScrollToCurrentTime(attempt)
    }
  }

  function resolveCurrentTimeScrollOffset(container: HTMLElement, markers: HTMLElement[]) {
    const containerRect = container.getBoundingClientRect()
    const containerMiddle = containerRect.top + containerRect.height / 2
    let bestMarker: HTMLElement | null = null
    let minDistance = Number.POSITIVE_INFINITY

    markers.forEach((marker) => {
      const markerRect = marker.getBoundingClientRect()
      const markerMiddle = markerRect.top + markerRect.height / 2
      const distance = Math.abs(markerMiddle - containerMiddle)
      if (distance < minDistance) {
        minDistance = distance
        bestMarker = marker
      }
    })

    const resolvedMarker = bestMarker as HTMLElement | null
    if (!resolvedMarker) {
      return null
    }

    const markerRect = resolvedMarker.getBoundingClientRect()
    return (
      markerRect.top -
      containerRect.top +
      container.scrollTop -
      containerRect.height / 2 +
      markerRect.height / 2
    )
  }

  function retryScrollToCurrentTime(attempt: number) {
    if (attempt >= CURRENT_TIME_SCROLL_MAX_ATTEMPTS) {
      return
    }

    queueScrollToCurrentTime(CURRENT_TIME_SCROLL_RETRY_DELAY, attempt + 1)
  }

  function queueScrollToCurrentTime(delay = 300, attempt = 0) {
    if (scrollTimeoutId !== null) {
      window.clearTimeout(scrollTimeoutId)
    }
    scrollTimeoutId = window.setTimeout(() => {
      scrollTimeoutId = null
      scrollToCurrentTime(attempt)
    }, delay)
  }

  function resolveScrollContainerElement(target: CalendarScrollContainerRef): HTMLElement | null {
    if (!target) {
      return null
    }
    if (target instanceof HTMLElement) {
      return target
    }

    const element = target.$el
    return element instanceof HTMLElement ? element : null
  }

  function getWorkHourStyle(date: string): CSSProperties {
    const weekDay = workHours.value ? getWorkHourForDate(workHours.value, date) : null
    if (!weekDay?.timeFrom || !weekDay?.timeTo) {
      return {}
    }

    const [fromHours = 0, fromMinutes = 0] = weekDay.timeFrom.split(':').map(Number)
    const [toHours = 0, toMinutes = 0] = weekDay.timeTo.split(':').map(Number)
    const fromMin = fromHours * 60 + fromMinutes
    const toMin = toHours * 60 + toMinutes

    return {
      position: 'absolute',
      left: '0px',
      right: '0px',
      top: `${(fromMin / (24 * 60)) * 100}%`,
      height: `${((toMin - fromMin) / (24 * 60)) * 100}%`,
      background: 'rgba(100,180,255,0.15)',
      zIndex: '0',
      pointerEvents: 'none',
    }
  }

  return {
    calendarScrollContainer,
    getWorkHourStyle,
    goToDate,
    goToNext,
    goToPrevious,
    goToToday,
    nowY,
    queueScrollToCurrentTime,
    scrollToCurrentTime,
    value,
  }
}
