import {
  getCurrentInstance,
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

const CALENDAR_SCROLL_RETRY_DELAY = 200
const CALENDAR_SCROLL_MAX_ATTEMPTS = 5

/** Owns calendar date navigation, current-time scrolling, and work-hour overlays. */
export function useSaplingCalendarNavigation(
  calendarType: Ref<CalendarType>,
  workHours: Ref<WorkHourWeekItem | null>,
) {
  const value = ref(formatLocalDate(new Date()))
  const calendarScrollContainer = ref<CalendarScrollContainerRef>(null)
  let scrollTimeoutId: number | null = null

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (scrollTimeoutId !== null) {
        window.clearTimeout(scrollTimeoutId)
      }
    })
  }

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
    const outer = resolveCalendarScrollOuter()
    if (!outer) {
      retryScrollToCurrentTime(attempt)
      return
    }

    const resolvedContainers = resolveCalendarScrollContainers(outer)
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

  function scrollToTime(target: Date | string, attempt = 0) {
    const targetDate = target instanceof Date ? new Date(target.getTime()) : new Date(target)
    if (!isValidDate(targetDate) || calendarType.value === 'month') {
      return
    }

    const outer = resolveCalendarScrollOuter()
    if (!outer) {
      retryScrollToTime(targetDate, attempt)
      return
    }

    const resolvedContainers = resolveCalendarScrollContainers(outer)
    const minutes = targetDate.getHours() * 60 + targetDate.getMinutes()
    let hasScrollableContainer = false

    resolvedContainers.forEach((container) => {
      if (container.scrollHeight <= container.clientHeight) {
        return
      }

      hasScrollableContainer = true
      const targetOffset =
        (minutes / (24 * 60)) * container.scrollHeight - container.clientHeight / 2
      container.scrollTop = Math.max(targetOffset, 0)
    })

    if (!hasScrollableContainer) {
      retryScrollToTime(targetDate, attempt)
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
    if (attempt >= CALENDAR_SCROLL_MAX_ATTEMPTS) {
      return
    }

    queueScrollToCurrentTime(CALENDAR_SCROLL_RETRY_DELAY, attempt + 1)
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

  function retryScrollToTime(target: Date, attempt: number) {
    if (attempt >= CALENDAR_SCROLL_MAX_ATTEMPTS) {
      return
    }

    queueScrollToTime(target, CALENDAR_SCROLL_RETRY_DELAY, attempt + 1)
  }

  function queueScrollToTime(target: Date | string, delay = 300, attempt = 0) {
    if (scrollTimeoutId !== null) {
      window.clearTimeout(scrollTimeoutId)
    }
    scrollTimeoutId = window.setTimeout(() => {
      scrollTimeoutId = null
      scrollToTime(target, attempt)
    }, delay)
  }

  function resolveCalendarScrollOuter(): HTMLElement | null {
    return (
      resolveScrollContainerElement(calendarScrollContainer.value) ||
      document.querySelector<HTMLElement>('.sapling-calendar-frame') ||
      document.querySelector<HTMLElement>('.calendar-card-text')
    )
  }

  function resolveCalendarScrollContainers(outer: HTMLElement): HTMLElement[] {
    const containers = Array.from(
      outer.querySelectorAll(
        '.v-calendar-daily__scroll-area, .v-calendar-weekly__scroll-area, .v-calendar-monthly__scroll-area',
      ),
    ) as HTMLElement[]
    return containers.length > 0 ? containers : [outer]
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

  function getWorkHourStyle(
    date: string,
    calendarWorkHours: WorkHourWeekItem | null = workHours.value,
  ): CSSProperties {
    const weekDay = calendarWorkHours ? getWorkHourForDate(calendarWorkHours, date) : null
    if (!weekDay?.timeFrom || !weekDay?.timeTo) {
      return {}
    }

    const [fromHours = 0, fromMinutes = 0] = weekDay.timeFrom.split(':').map(Number)
    const [toHours = 0, toMinutes = 0] = weekDay.timeTo.split(':').map(Number)
    const fromMin = fromHours * 60 + fromMinutes
    const toMin = toHours * 60 + toMinutes

    return {
      '--sapling-calendar-workhour-top': `${(fromMin / (24 * 60)) * 100}%`,
      '--sapling-calendar-workhour-height': `${((toMin - fromMin) / (24 * 60)) * 100}%`,
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
    queueScrollToTime,
    scrollToCurrentTime,
    scrollToTime,
    value,
  }
}
