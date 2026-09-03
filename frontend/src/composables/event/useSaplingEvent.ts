import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type {
  EntityItem,
  EventCategoryItem,
  EventStatusItem,
  EventTypeItem,
  PersonItem,
  WorkHourWeekItem,
} from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useSaplingFilterWork } from '@/composables/filter/useSaplingFilterWork'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingChipFilters } from '@/composables/filter/useSaplingChipFilters'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import { SaplingWindowWatcher } from '@/utils/saplingWindowWatcher'
import type { CalendarDatePair, CalendarType } from '@/composables/event/eventDate.utils'
import {
  getCalendarEventHandle,
  type CalendarEventOverlapMode,
  type CalendarMode,
  type CalendarViewMode,
  type SaplingCalendarEvent,
} from '@/composables/event/eventCalendar.utils'
import {
  loadEventCalendarPreferences,
  resolveCalendarIntervalHeight,
  saveEventCalendarPreferences,
} from '@/composables/event/eventCalendarPreferences'
import { useSaplingCalendarDrag } from '@/composables/event/useSaplingCalendarDrag'
import { useSaplingCalendarNavigation } from '@/composables/event/useSaplingCalendarNavigation'
import { useSaplingEventData } from '@/composables/event/useSaplingEventData'
import { useSaplingEventContextMenu } from '@/composables/event/useSaplingEventContextMenu'
import { useSaplingEventEditor } from '@/composables/event/useSaplingEventEditor'
import { useSaplingEventPresentation } from '@/composables/event/useSaplingEventPresentation'
import { useSaplingEventWorkspaceActions } from '@/composables/event/useSaplingEventWorkspaceActions'
import { useSaplingEventInitialization } from '@/composables/event/useSaplingEventInitialization'
import { resolvePersonWorkHours } from '@/composables/event/eventWorkHours'
import { setRouteQueryParameter } from '@/utils/routerNavigation'

const CALENDAR_TYPE_OPTIONS: CalendarType[] = ['day', 'workweek', 'week', 'month']

/**
 * Centralizes all state, lifecycle hooks and UI helpers for the event calendar screen.
 * The component stays template-focused while the composable owns loading, responsiveness
 * and calendar-specific interaction logic.
 */
export function useSaplingEvent() {
  //#region State
  const route = useRoute()
  const router = useRouter()
  const { isLoading: isTranslationLoading, loadTranslations } = useTranslationLoader(
    'navigation',
    'calendar',
    'global',
    'event',
    'eventStatus',
    'filter',
    'holiday',
  )
  const currentPersonStore = useCurrentPersonStore()
  const currentPermissionStore = useCurrentPermissionStore()
  const { pushMessage } = useSaplingMessageCenter()
  const windowWatcher = new SaplingWindowWatcher()
  const initialWindowSize = windowWatcher.getCurrentSize()
  const initialCalendarPreferences = loadEventCalendarPreferences()
  const { peopleMap } = useSaplingFilterWork()

  const eventEntityHandle = ref('event')
  const ownPerson = ref<PersonItem | null>(null)
  const defaultEventType = ref<EventTypeItem | null>(null)
  const defaultEventStatus = ref<EventStatusItem | null>(null)
  const defaultEventCategory = ref<EventCategoryItem | null>(null)
  const events = ref<SaplingCalendarEvent[]>([])
  const templates = ref<EntityTemplate[]>([])
  const {
    chipFilters,
    selectedChipFilters,
    selectedChipFilterCount,
    loadChipFilters,
    onSelectedChipFiltersUpdate,
    buildChipFilterClauses,
  } = useSaplingChipFilters({
    entityHandle: eventEntityHandle,
    entityTemplates: templates,
  })
  const selectedPeoples = ref<number[]>([])
  const preferredCalendarType = ref<CalendarType>(initialCalendarPreferences.calendarType)
  const preferredCalendarViewMode = ref<CalendarViewMode>(
    initialCalendarPreferences.calendarViewMode,
  )
  const calendarMode = ref<CalendarMode>(initialCalendarPreferences.calendarMode)
  const calendarType = ref<CalendarType>(
    initialWindowSize === 'small' ? 'day' : preferredCalendarType.value,
  )
  const calendarViewMode = ref<CalendarViewMode>(
    initialWindowSize === 'small' ? 'single' : preferredCalendarViewMode.value,
  )
  const eventOverlapMode = ref<CalendarEventOverlapMode>(
    initialCalendarPreferences.eventOverlapMode,
  )
  const linkedScrolling = ref(initialCalendarPreferences.linkedScrolling)
  const timeGridScale = ref(initialCalendarPreferences.timeGridScale)
  const timeRangeMode = ref(initialCalendarPreferences.timeRangeMode)
  const calendarIntervalHeight = computed(() => resolveCalendarIntervalHeight(timeGridScale.value))
  const isNarrowScreen = ref(initialWindowSize === 'small')
  const entityEvent = ref<EntityItem | null>(null)
  const editEvent = ref<CalendarEvent | null>(null)
  // Names of fields that should be marked dirty in the edit dialog after an
  // external interaction (e.g. drag/resize updated startDate/endDate before
  // the form was hydrated). The dialog highlights these fields exactly like
  // a manual edit and enables the save button.
  const forceEditDialogDirtyFields = ref<string[]>([])
  const calendarDateRange = ref<CalendarDatePair | null>(null)
  const showEditDialog = ref(false)
  let openPersistedEventEditorDelegate: (
    calendarEvent: CalendarEvent,
    forcedDirtyFields: string[],
  ) => Promise<void> = async () => undefined
  const {
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
  } = useSaplingCalendarDrag({
    events,
    selectedPeople: selectedPeoples,
    peopleMap,
    ownPerson,
    defaultEventType,
    defaultEventStatus,
    defaultEventCategory,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    openPersistedEventEditor: (calendarEvent, forcedDirtyFields) =>
      openPersistedEventEditorDelegate(calendarEvent, forcedDirtyFields),
  })
  const fetchedWorkHours = ref<WorkHourWeekItem | null>(null)
  const workHours = computed(() => {
    const ownPersonHandle = ownPerson.value?.handle
    const person =
      typeof ownPersonHandle === 'number'
        ? (peopleMap.value[ownPersonHandle] ?? ownPerson.value)
        : ownPerson.value
    return resolvePersonWorkHours(person, fetchedWorkHours.value)
  })
  const {
    calendarScrollContainer,
    calendarTimeGrid,
    getWorkHourStyle,
    goToDate,
    goToNext,
    goToPrevious,
    goToToday,
    nowY,
    queueScrollToCurrentTime,
    queueScrollToTime,
    scrollToCurrentTime,
    value,
  } = useSaplingCalendarNavigation(calendarType, workHours, timeRangeMode)
  const {
    currentDateRangeLabel,
    currentMonthLabel,
    getCalendarEventParticipants,
    getEventsForPerson,
    getPersonName,
    getSelectedHolidayGroupHandles,
    getSideBySideEvents,
    heroStats,
    selectedPeopleOverflowCount,
    selectedPeoplePreview,
    sideBySideGridStyle,
    todayEventsCount,
    upcomingEvents,
  } = useSaplingEventPresentation({
    events,
    selectedPeople: selectedPeoples,
    ownPerson,
    peopleMap,
    calendarType,
    calendarViewMode,
    calendarDateRange,
    calendarValue: value,
    createEvent,
    getEventColor,
  })
  const {
    getEvents: loadCalendarEvents,
    loadPersistedEvent,
    loadSelectedPeopleDetails,
    refreshVisibleEvents,
  } = useSaplingEventData({
    events,
    selectedPeople: selectedPeoples,
    peopleMap,
    calendarMode,
    calendarType,
    calendarDateRange,
    buildChipFilterClauses,
    getSelectedHolidayGroupHandles,
  })

  async function getEvents(nextRange: CalendarDatePair) {
    await loadCalendarEvents(nextRange)
    await nextTick()
    queueCalendarFocusScroll(0)
  }
  const eventEditor = useSaplingEventEditor({
    events,
    templates,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    loadPersistedEvent,
    refreshVisibleEvents,
    goToDate,
    queueScrollToCurrentTime,
    queueScrollToTime,
    clearCreatedEvent,
    clearDragSnapshot,
    consumeSuppressedEventClick,
    resetDialogInteractionState,
    restoreDragSnapshot,
  })
  openPersistedEventEditorDelegate = eventEditor.openPersistedEventEditor
  const {
    chooseRecurrenceEditOccurrence,
    chooseRecurrenceEditSeries,
    closeRecurrenceEditScopeDialog,
    closeUpdateConflictDialog,
    handleUpdateConflictVisibility,
    mergeUpdateConflict,
    onEditDialogCancel,
    onEditDialogItemUpdate,
    onEditDialogModeUpdate,
    onEditDialogSave,
    openEventEditor,
    openEventFromRoute,
    openUpdateConflictChangeLog,
    reloadUpdateConflictRecord,
    updateConflictDialog,
    recurrenceEditScopeDialog,
    isDetachingOccurrence,
  } = eventEditor
  const {
    closeEventContextMenu,
    closeInformationDialog,
    closeMaterializeRecurrenceDialog,
    closeUploadDialog,
    confirmMaterializeRecurrence,
    eventContextMenu,
    eventContextMenuItems,
    eventContextMenuTarget,
    handleEventContextMenuAction,
    informationDialogItem,
    loadEventScriptButtons,
    materializeRecurrenceDialog,
    openEventContextMenu,
    showInformationDialog,
    showUploadDialog,
    uploadDialogItem,
  } = useSaplingEventContextMenu({
    templates,
    entityEvent,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    clearDragSnapshot,
    loadPersistedEvent,
    refreshVisibleEvents,
  })
  const isCalendarInitializing = ref(true)
  const {
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
  } = useSaplingEventWorkspaceActions({
    route,
    ownPerson,
    currentPerson: () => currentPersonStore.person,
    peopleMap,
    workHours: fetchedWorkHours,
    selectedPeople: selectedPeoples,
    editEvent,
    calendarDateRange,
    calendarType,
    calendarViewMode,
    refreshVisibleEvents,
    queueScrollToTime,
    queueScrollToCurrentTime,
    pushMessage,
  })
  const { loadOwnPerson, loadTemplates, loadEventDefaults, loadEventEntity } =
    useSaplingEventInitialization({
      currentPersonStore,
      ownPerson,
      peopleMap,
      selectedPeople: selectedPeoples,
      templates,
      defaultEventType,
      defaultEventStatus,
      defaultEventCategory,
      entityEvent,
    })
  const isLoading = computed(() => isTranslationLoading.value || isCalendarInitializing.value)

  let stopWindowWatcher: (() => void) | null = null

  //#endregion

  //#region Lifecycle
  stopWindowWatcher = windowWatcher.onChange((size) => {
    const isSmall = size === 'small'

    if (isSmall) {
      if (!isNarrowScreen.value) {
        preferredCalendarType.value = calendarType.value
        preferredCalendarViewMode.value = calendarViewMode.value
      }

      isNarrowScreen.value = true
      calendarType.value = 'day'
      calendarViewMode.value = 'single'
      return
    }

    if (isNarrowScreen.value) {
      isNarrowScreen.value = false
      calendarType.value = preferredCalendarType.value
      calendarViewMode.value = preferredCalendarViewMode.value
    }
  })

  onMounted(async () => {
    isCalendarInitializing.value = true

    try {
      await loadOwnPerson()
      await Promise.all([
        loadTranslations(),
        currentPermissionStore.fetchCurrentPermission(),
        loadEventDefaults(),
        loadEventEntity(),
        loadEventScriptButtons(),
        loadTemplates(),
        loadWorkHours(),
        loadSelectedPeopleDetails(),
      ])
      await loadChipFilters()
    } finally {
      isCalendarInitializing.value = false
    }

    const didOpenEvent = await openEventFromRoute()
    if (!didOpenEvent) {
      queueScrollToCurrentTime()
    }
  })

  onBeforeUnmount(() => {
    stopWindowWatcher?.()
    windowWatcher.destroy()
  })

  watch(
    selectedPeoples,
    async () => {
      if (isCalendarInitializing.value) {
        return
      }

      await loadSelectedPeopleDetails()
      await refreshVisibleEvents()
    },
    { deep: true },
  )

  watch([calendarType, calendarViewMode, value, timeGridScale, timeRangeMode], () => {
    void nextTick(() => {
      queueCalendarFocusScroll()
    })
  })

  watch(
    [
      calendarType,
      calendarViewMode,
      calendarMode,
      eventOverlapMode,
      linkedScrolling,
      timeGridScale,
      timeRangeMode,
    ],
    () => {
      if (!isNarrowScreen.value) {
        preferredCalendarType.value = calendarType.value
        preferredCalendarViewMode.value = calendarViewMode.value
      }

      saveEventCalendarPreferences({
        calendarType: preferredCalendarType.value,
        calendarViewMode: preferredCalendarViewMode.value,
        calendarMode: calendarMode.value,
        eventOverlapMode: eventOverlapMode.value,
        linkedScrolling: linkedScrolling.value,
        timeGridScale: timeGridScale.value,
        timeRangeMode: timeRangeMode.value,
      })
    },
  )

  watch(calendarMode, async () => {
    await refreshVisibleEvents()
  })

  watch(
    selectedChipFilters,
    async () => {
      await refreshVisibleEvents()
    },
    { deep: true },
  )

  watch(
    () => [route.query.open, route.query.occurrence] as const,
    () => {
      if (isCalendarInitializing.value) {
        return
      }

      void openEventFromRoute()
    },
  )

  let routeEditEventHandle: string | null = null

  watch(
    () =>
      [
        showEditDialog.value,
        getCalendarEventHandle(editEvent.value),
        isDetachingOccurrence.value,
      ] as const,
    ([isVisible, handle, isDetaching], [wasVisible]) => {
      if (isVisible && handle != null) {
        routeEditEventHandle = String(handle)
        void setRouteQueryParameter(router, route, 'open', handle)
        return
      }

      const routeHandle = Array.isArray(route.query.open) ? route.query.open[0] : route.query.open
      if (isVisible && isDetaching && typeof routeHandle === 'string') {
        routeEditEventHandle = routeHandle
        return
      }

      if (wasVisible && !isVisible && routeEditEventHandle !== null) {
        routeEditEventHandle = null
        const query = { ...route.query }
        delete query.open
        delete query.occurrence
        void router.replace({ hash: route.hash, query })
      }
    },
  )
  //#endregion

  //#region Events

  //#region Return
  return {
    chooseRecurrenceEditOccurrence,
    chooseRecurrenceEditSeries,
    closeRecurrenceEditScopeDialog,
    forceEditDialogDirtyFields,
    calendarScrollContainer,
    calendarDisplayType,
    calendarIntervalHeight,
    calendarTimeGrid,
    calendarType,
    calendarTypeOptions: CALENDAR_TYPE_OPTIONS,
    calendarViewMode,
    calendarMode,
    eventOverlapMode,
    calendarSyncProvider,
    calendarWeekdays,
    createEvent,
    currentCalendarLayoutLabel,
    currentDateRangeLabel,
    currentCalendarViewLabel,
    currentMonthLabel,
    eventContextMenu,
    eventContextMenuItems,
    eventContextMenuTarget,
    materializeRecurrenceDialog,
    recurrenceEditScopeDialog,
    isDetachingOccurrence,
    editEvent,
    entityEvent,
    chipFilters,
    updateConflictDialog,
    events,
    getEventColor,
    getCalendarEventParticipants,
    getEvents,
    getEventsForPerson,
    getPersonName,
    getPersonWorkHours,
    getSideBySideEvents,
    getWorkHourStyle,
    goToDate,
    goToNext,
    goToPrevious,
    goToToday,
    isCalendarDragActive,
    isLoading,
    isRefreshingCalendar,
    isSyncingExternalCalendar,
    isNarrowScreen,
    linkedScrolling,
    timeGridScale,
    timeRangeMode,
    nowY,
    openEventContextMenu,
    onEditDialogCancel,
    closeUpdateConflictDialog,
    handleUpdateConflictVisibility,
    handleEventContextMenuAction,
    mergeUpdateConflict,
    onEditDialogItemUpdate,
    onEditDialogModeUpdate,
    onEditDialogSave,
    openUpdateConflictChangeLog,
    openEventEditor,
    onSelectedChipFiltersUpdate,
    onSelectedPeoplesUpdate,
    refreshCalendar,
    reloadUpdateConflictRecord,
    scrollToCurrentTime,
    selectedPeoples,
    selectedChipFilters,
    selectedChipFilterCount,
    selectedPeopleOverflowCount,
    selectedPeoplePreview,
    syncExternalCalendar,
    closeEventContextMenu,
    closeInformationDialog,
    closeMaterializeRecurrenceDialog,
    closeUploadDialog,
    confirmMaterializeRecurrence,
    showEditDialog,
    showInformationDialog,
    showWorkHourBackground,
    showUploadDialog,
    sideBySideGridStyle,
    startDrag,
    startTime,
    extendBottom,
    mouseMove,
    endDrag,
    cancelDrag,
    heroStats,
    templates,
    todayEventsCount,
    informationDialogItem,
    uploadDialogItem,
    upcomingEvents,
    value,
    workHours,
  }
  //#endregion
}
