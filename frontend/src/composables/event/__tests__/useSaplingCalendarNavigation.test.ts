import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkHourWeekItem } from '@/entity/entity'
import { useSaplingCalendarNavigation } from '../useSaplingCalendarNavigation'

describe('useSaplingCalendarNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('moves day, week, and month anchors by their logical units', () => {
    const calendarType = ref<'day' | 'workweek' | 'week' | 'month'>('day')
    const navigation = useSaplingCalendarNavigation(calendarType, ref(null))
    navigation.value.value = '2026-07-15'

    navigation.goToNext()
    expect(navigation.value.value).toBe('2026-07-16')

    calendarType.value = 'week'
    navigation.goToPrevious()
    expect(navigation.value.value).toBe('2026-07-06')

    calendarType.value = 'month'
    navigation.value.value = '2026-07-01'
    navigation.goToNext()
    expect(navigation.value.value).toBe('2026-08-01')
  })

  it('normalizes direct navigation to the active workweek anchor', () => {
    const calendarType = ref<'day' | 'workweek' | 'week' | 'month'>('workweek')
    const navigation = useSaplingCalendarNavigation(calendarType, ref(null))

    navigation.goToDate('2026-07-15')

    expect(navigation.value.value).toBe('2026-07-13')
  })

  it('projects configured work hours into a calendar overlay', () => {
    const workHours = ref({
      wednesday: { timeFrom: '08:00', timeTo: '16:00' },
    } as unknown as WorkHourWeekItem)
    const navigation = useSaplingCalendarNavigation(ref('week'), workHours)

    expect(navigation.getWorkHourStyle('2026-07-15')).toMatchObject({
      '--sapling-calendar-workhour-top': `${(8 / 24) * 100}%`,
      '--sapling-calendar-workhour-height': `${(8 / 24) * 100}%`,
    })
  })

  it('projects an explicitly selected persons work week for a calendar column', () => {
    const ownWorkHours = ref({
      wednesday: { timeFrom: '08:00', timeTo: '17:00' },
    } as unknown as WorkHourWeekItem)
    const otherWorkHours = {
      wednesday: { timeFrom: '10:00', timeTo: '14:00' },
    } as unknown as WorkHourWeekItem
    const navigation = useSaplingCalendarNavigation(ref('week'), ownWorkHours)

    expect(navigation.getWorkHourStyle('2026-07-15', otherWorkHours)).toMatchObject({
      '--sapling-calendar-workhour-top': `${(10 / 24) * 100}%`,
      '--sapling-calendar-workhour-height': `${(4 / 24) * 100}%`,
    })
  })

  it('projects work hours relative to the configured working-time range', () => {
    const workHours = ref({
      monday: { timeFrom: '08:00', timeTo: '17:00' },
    } as unknown as WorkHourWeekItem)
    const navigation = useSaplingCalendarNavigation(
      ref('week'),
      workHours,
      ref<'workHours'>('workHours'),
    )

    expect(navigation.calendarTimeGrid.value).toEqual({
      firstTime: 420,
      intervalCount: 11,
      startMinute: 420,
      endMinute: 1080,
    })
    expect(navigation.getWorkHourStyle('2026-07-13')).toMatchObject({
      '--sapling-calendar-workhour-top': `${(1 / 11) * 100}%`,
      '--sapling-calendar-workhour-height': `${(9 / 11) * 100}%`,
    })
  })

  it('centers a selected time relative to the working-time range', () => {
    const outer = document.createElement('div')
    const container = document.createElement('div')
    container.className = 'v-calendar-weekly__scroll-area'
    outer.append(container)
    document.body.append(outer)

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1100 },
    })

    const workHours = ref({
      monday: { timeFrom: '08:00', timeTo: '17:00' },
    } as unknown as WorkHourWeekItem)
    const navigation = useSaplingCalendarNavigation(
      ref('week'),
      workHours,
      ref<'workHours'>('workHours'),
    )
    navigation.calendarScrollContainer.value = outer
    navigation.scrollToTime(new Date(2026, 6, 13, 12))

    expect(container.scrollTop).toBe(300)
  })

  it('positions the current-time marker relative to the visible range and hides it outside', () => {
    vi.useFakeTimers()
    const workHours = ref({
      monday: { timeFrom: '08:00', timeTo: '17:00' },
    } as unknown as WorkHourWeekItem)
    const navigation = useSaplingCalendarNavigation(
      ref('week'),
      workHours,
      ref<'workHours'>('workHours'),
    )

    vi.setSystemTime(new Date(2026, 6, 13, 12))
    expect(navigation.nowY()).toBe(`${(5 / 11) * 100}%`)

    vi.setSystemTime(new Date(2026, 6, 13, 20))
    expect(navigation.nowY()).toBeNull()
  })

  it('centers the current-time marker in the inner calendar scroll area', () => {
    const outer = document.createElement('div')
    outer.className = 'sapling-calendar-frame'
    const container = document.createElement('div')
    const marker = document.createElement('div')
    container.className = 'v-calendar-daily__scroll-area'
    marker.className = 'v-current-time'
    container.append(marker)
    outer.append(container)
    document.body.append(outer)

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    })
    container.getBoundingClientRect = () => ({ top: 100, height: 400 }) as DOMRect
    marker.getBoundingClientRect = () => ({ top: 580, height: 2 }) as DOMRect

    const navigation = useSaplingCalendarNavigation(ref('week'), ref(null))
    navigation.scrollToCurrentTime()

    expect(container.scrollTop).toBe(281)
  })

  it('centers a selected event start time in the inner calendar scroll area', () => {
    const outer = document.createElement('div')
    const container = document.createElement('div')
    container.className = 'v-calendar-weekly__scroll-area'
    outer.append(container)
    document.body.append(outer)

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 2400 },
    })

    const navigation = useSaplingCalendarNavigation(ref('week'), ref(null))
    navigation.calendarScrollContainer.value = outer
    navigation.scrollToTime(new Date(2026, 6, 15, 9))

    expect(container.scrollTop).toBe(700)
  })

  it('retries until the rendered calendar scroll area is available', () => {
    vi.useFakeTimers()
    const navigation = useSaplingCalendarNavigation(ref('week'), ref(null))

    navigation.queueScrollToCurrentTime(0)
    vi.advanceTimersByTime(0)

    const outer = document.createElement('div')
    const container = document.createElement('div')
    const marker = document.createElement('div')
    container.className = 'v-calendar-daily__scroll-area'
    marker.className = 'v-current-time'
    container.append(marker)
    outer.append(container)
    document.body.append(outer)
    navigation.calendarScrollContainer.value = outer

    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1200 },
    })
    container.getBoundingClientRect = () => ({ top: 100, height: 400 }) as DOMRect
    marker.getBoundingClientRect = () => ({ top: 580, height: 2 }) as DOMRect

    vi.advanceTimersByTime(200)

    expect(container.scrollTop).toBe(281)
  })
})
