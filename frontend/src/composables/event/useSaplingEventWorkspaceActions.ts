import { computed, ref, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { PersonItem, WorkHourWeekItem } from '@/entity/entity'
import ApiCalendarService, {
  type CalendarImportResult,
  type CalendarSyncProvider,
} from '@/services/api.calendar.service'
import ApiCurrentService from '@/services/api.current.service'
import { i18n } from '@/i18n'
import { parseLocalCalendarDate, type CalendarDatePair, type CalendarType } from './eventDate.utils'
import { getCalendarEventHandle, type CalendarViewMode } from './eventCalendar.utils'

type PushMessage = (
  type: 'success' | 'info' | 'warning' | 'error',
  message: string,
  description: string,
  entity: string,
  technical?: unknown,
  descriptionParams?: Record<string, unknown>,
) => void

export function useSaplingEventWorkspaceActions(options: {
  route: RouteLocationNormalizedLoaded
  ownPerson: Ref<PersonItem | null>
  currentPerson: () => PersonItem | null
  peopleMap: Ref<Record<number, PersonItem>>
  workHours: Ref<WorkHourWeekItem | null>
  selectedPeople: Ref<number[]>
  editEvent: Ref<CalendarEvent | null>
  calendarDateRange: Ref<CalendarDatePair | null>
  calendarType: Ref<CalendarType>
  calendarViewMode: Ref<CalendarViewMode>
  refreshVisibleEvents: () => Promise<void>
  queueScrollToTime: (value: Date | string, delay?: number) => void
  queueScrollToCurrentTime: (delay?: number) => void
  pushMessage: PushMessage
}) {
  const isRefreshingCalendar = ref(false)
  const isSyncingExternalCalendar = ref(false)
  const calendarDisplayType = computed(() =>
    options.calendarType.value === 'workweek' ? 'week' : options.calendarType.value,
  )
  const calendarWeekdays = computed(() =>
    options.calendarType.value === 'workweek' ? [1, 2, 3, 4, 5] : undefined,
  )
  const showWorkHourBackground = computed(() =>
    ['day', 'week', 'workweek'].includes(options.calendarType.value),
  )
  const currentCalendarViewLabel = computed(() =>
    i18n.global.t(`calendar.${options.calendarType.value}`),
  )
  const currentCalendarLayoutLabel = computed(() =>
    i18n.global.t(
      options.calendarViewMode.value === 'single' ? 'calendar.combined' : 'calendar.sideBySide',
    ),
  )
  const calendarSyncProvider = computed<CalendarSyncProvider | null>(() => {
    const personType = options.ownPerson.value?.type ?? options.currentPerson()?.type
    const typeHandle = typeof personType === 'string' ? personType : personType?.handle
    return typeHandle === 'azure' || typeHandle === 'google' ? typeHandle : null
  })

  async function loadWorkHours() {
    options.workHours.value = await ApiCurrentService.getWorkWeek()
  }

  function getPersonWorkHours(personId: number): WorkHourWeekItem | null {
    const ownPersonHandle = options.ownPerson.value?.handle
    const person =
      options.peopleMap.value[personId] ??
      (personId === ownPersonHandle ? options.ownPerson.value : null)
    const personWorkWeek =
      typeof person?.workWeek === 'object' && person.workWeek ? person.workWeek : null
    if (personWorkWeek) return personWorkWeek

    const companyWorkWeek =
      typeof person?.company?.workWeek === 'object' && person.company.workWeek
        ? person.company.workWeek
        : null
    if (companyWorkWeek) return companyWorkWeek
    return personId === ownPersonHandle ? options.workHours.value : null
  }

  async function refreshCalendar() {
    if (isRefreshingCalendar.value) return
    isRefreshingCalendar.value = true
    try {
      await options.refreshVisibleEvents()
    } catch {
      // Shared API handling already publishes the load error.
    } finally {
      isRefreshingCalendar.value = false
    }
  }

  async function syncExternalCalendar() {
    if (
      !options.calendarDateRange.value ||
      isSyncingExternalCalendar.value ||
      !calendarSyncProvider.value
    ) {
      return
    }
    isSyncingExternalCalendar.value = true
    const provider = calendarSyncProvider.value
    const startDate = parseLocalCalendarDate(options.calendarDateRange.value.start.date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = parseLocalCalendarDate(options.calendarDateRange.value.end.date)
    endDate.setHours(23, 59, 59, 999)
    try {
      const result: CalendarImportResult = await ApiCalendarService.importEvents(provider, {
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
      })
      await options.refreshVisibleEvents()
      options.pushMessage(
        'success',
        i18n.global.t(
          provider === 'azure' ? 'calendar.syncOutlookSuccess' : 'calendar.syncGoogleSuccess',
        ),
        i18n.global.t('calendar.syncCalendarSuccessDescription', {
          imported: result.imported,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
        }),
        'calendar',
      )
    } catch {
      // Shared API handling already publishes the provider or validation error.
    } finally {
      isSyncingExternalCalendar.value = false
    }
  }

  function getRouteSelectedEventStart(): Date | string | null {
    const routeHandle = Array.isArray(options.route.query.open)
      ? options.route.query.open[0]
      : options.route.query.open
    const selectedHandle = getCalendarEventHandle(options.editEvent.value)
    if (
      routeHandle == null ||
      selectedHandle == null ||
      String(routeHandle) !== String(selectedHandle)
    ) {
      return null
    }
    const startDate = options.editEvent.value?.event?.startDate
    if (startDate instanceof Date || typeof startDate === 'string') return startDate
    const start = options.editEvent.value?.start
    if (start instanceof Date || typeof start === 'string') return start
    return typeof start === 'number' && Number.isFinite(start) ? new Date(start) : null
  }

  function queueCalendarFocusScroll(delay = 300) {
    const focusTime = getRouteSelectedEventStart()
    if (focusTime) options.queueScrollToTime(focusTime, delay)
    else options.queueScrollToCurrentTime(delay)
  }

  function onSelectedPeoplesUpdate(values: string[]) {
    options.selectedPeople.value = values
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => !Number.isNaN(value))
  }

  return {
    calendarDisplayType,
    calendarSyncProvider,
    calendarWeekdays,
    currentCalendarLayoutLabel,
    currentCalendarViewLabel,
    getPersonWorkHours,
    isRefreshingCalendar,
    isSyncingExternalCalendar,
    loadWorkHours,
    onSelectedPeoplesUpdate,
    queueCalendarFocusScroll,
    refreshCalendar,
    showWorkHourBackground,
    syncExternalCalendar,
  }
}
