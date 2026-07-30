import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { PersonItem } from '@/entity/entity'
import type { SaplingCalendarEvent } from '../eventCalendar.utils'
import { useSaplingEventPresentation } from '../useSaplingEventPresentation'

function createHarness() {
  const events = ref<SaplingCalendarEvent[]>([])
  const selectedPeople = ref([7, 9])
  const ownPerson = ref<PersonItem | null>({
    handle: 7,
    displayName: 'Ada Owner',
    holidayGroup: { handle: 3 },
  } as unknown as PersonItem)
  const peopleMap = ref<Record<number, PersonItem>>({
    9: {
      handle: 9,
      firstName: 'Grace',
      lastName: 'Hopper',
      holidayGroup: { handle: 5 },
    } as PersonItem,
  })
  const calendarType = ref<'day' | 'workweek' | 'week' | 'month'>('week')
  const calendarViewMode = ref<'single' | 'sidebyside'>('single')
  const calendarDateRange = ref({
    start: { date: '2026-07-13', year: 2026, month: 7, day: 13, hour: 0, minute: 0 },
    end: { date: '2026-07-19', year: 2026, month: 7, day: 19, hour: 0, minute: 0 },
  })
  const calendarValue = ref('2026-07-13')
  const createEvent = ref<CalendarEvent | null>(null)
  const presentation = useSaplingEventPresentation({
    events,
    selectedPeople,
    ownPerson,
    peopleMap,
    calendarType,
    calendarViewMode,
    calendarDateRange,
    calendarValue,
    createEvent,
    getEventColor: () => '#336699',
  })

  return {
    calendarViewMode,
    createEvent,
    events,
    presentation,
  }
}

describe('useSaplingEventPresentation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('projects today events, hero stats, people, and agenda participants', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15, 12))
    const harness = createHarness()
    harness.events.value = [
      {
        start: new Date(2026, 6, 15, 9).getTime(),
        end: new Date(2026, 6, 15, 10).getTime(),
        timed: true,
        color: '#336699',
        saplingSource: 'event',
        event: {
          handle: 42,
          title: 'Planning',
          description: 'Microsoft Teams meeting with a long imported body',
          onlineMeetingURL: 'https://teams.example.test/join',
          participants: [7, { handle: 9, title: 'Doctor' }],
          status: { color: '#F44336' },
          category: { icon: 'mdi-lifebuoy', color: '#009688' },
        },
      } as unknown as SaplingCalendarEvent,
    ]

    expect(harness.presentation.todayEventsCount.value).toBe(1)
    expect(harness.presentation.heroStats.value.map((stat) => stat.value)).toEqual(['1', '1', '2'])
    expect(harness.presentation.selectedPeoplePreview.value).toEqual([
      { handle: 7, name: 'Ada Owner', isOwn: true },
      { handle: 9, name: 'Grace Hopper', isOwn: false },
    ])
    expect(harness.presentation.upcomingEvents.value[0]?.participantNames).toEqual([
      'Ada Owner',
      'Grace Hopper',
    ])
    expect(harness.presentation.upcomingEvents.value[0]).toMatchObject({
      title: 'Planning',
      onlineMeetingUrl: 'https://teams.example.test/join',
      icon: 'mdi-lifebuoy',
      accentColor: '#F44336',
      categoryColor: '#009688',
    })
    expect(harness.presentation.upcomingEvents.value[0]).not.toHaveProperty('description')
  })

  it('adds a draft only to matching side-by-side person columns', () => {
    const harness = createHarness()
    harness.calendarViewMode.value = 'sidebyside'
    harness.createEvent.value = {
      start: 1,
      end: 2,
      timed: true,
      event: { participants: [9] },
    }

    expect(harness.presentation.getSideBySideEvents(7)).toHaveLength(0)
    expect(harness.presentation.getSideBySideEvents(9)).toHaveLength(1)
    expect(harness.presentation.getSideBySideEvents(9)[0]?.event?.participants).toEqual([9])
  })

  it('does not duplicate a draft that is already part of the loaded events', () => {
    const harness = createHarness()
    harness.calendarViewMode.value = 'sidebyside'
    const draft = {
      start: 1,
      end: 2,
      timed: true,
      event: { participants: [9] },
    } as unknown as SaplingCalendarEvent
    harness.events.value = [draft]
    harness.createEvent.value = draft

    expect(harness.presentation.getSideBySideEvents(9)).toEqual([draft])
  })

  it('collects effective holiday groups from own and loaded people', () => {
    const harness = createHarness()
    expect(harness.presentation.getSelectedHolidayGroupHandles()).toEqual([3, 5])
  })
})
