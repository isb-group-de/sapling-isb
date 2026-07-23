import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ApiGenericService from '@/services/api.generic.service'
import type {
  EntityItem,
  EventStatusItem,
  EventTypeItem,
  PersonItem,
  WorkHourWeekItem,
} from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { useTranslationLoader } from '@/composables/generic/useTranslationLoader'
import ApiCalendarService, {
  type CalendarImportResult,
  type CalendarSyncProvider,
} from '@/services/api.calendar.service'
import ApiCurrentService from '@/services/api.current.service'
import ApiTemplateService from '@/services/api.template.service'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useSaplingFilterWork } from '@/composables/filter/useSaplingFilterWork'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import { useSaplingChipFilters } from '@/composables/filter/useSaplingChipFilters'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import { SaplingWindowWatcher } from '@/utils/saplingWindowWatcher'
import { i18n } from '@/i18n'
import {
  parseLocalCalendarDate,
  type CalendarDatePair,
  type CalendarType,
} from '@/composables/event/eventDate.utils'
import {
  DEFAULT_EVENT_STATUS_HANDLE,
  DEFAULT_EVENT_TYPE_HANDLE,
  type CalendarMode,
  type CalendarViewMode,
  type SaplingCalendarEvent,
} from '@/composables/event/eventCalendar.utils'
import { useSaplingCalendarDrag } from '@/composables/event/useSaplingCalendarDrag'
import { useSaplingCalendarNavigation } from '@/composables/event/useSaplingCalendarNavigation'
import { useSaplingEventData } from '@/composables/event/useSaplingEventData'
import { useSaplingEventContextMenu } from '@/composables/event/useSaplingEventContextMenu'
import { useSaplingEventEditor } from '@/composables/event/useSaplingEventEditor'
import { useSaplingEventPresentation } from '@/composables/event/useSaplingEventPresentation'

const CALENDAR_TYPE_OPTIONS: CalendarType[] = ['day', 'workweek', 'week', 'month']
const WORKWEEK_DAYS = [1, 2, 3, 4, 5]

/**
 * Centralizes all state, lifecycle hooks and UI helpers for the event calendar screen.
 * The component stays template-focused while the composable owns loading, responsiveness
 * and calendar-specific interaction logic.
 */
export function useSaplingEvent() {
  //#region State
  const route = useRoute()
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
  const { peopleMap } = useSaplingFilterWork()

  const eventEntityHandle = ref('event')
  const ownPerson = ref<PersonItem | null>(null)
  const defaultEventType = ref<EventTypeItem | null>(null)
  const defaultEventStatus = ref<EventStatusItem | null>(null)
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
  const calendarMode = ref<CalendarMode>('default')
  const calendarType = ref<CalendarType>(
    windowWatcher.getCurrentSize() === 'small' ? 'day' : 'workweek',
  )
  const calendarViewMode = ref<CalendarViewMode>('single')
  const isNarrowScreen = ref(windowWatcher.getCurrentSize() === 'small')
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
    ownPerson,
    defaultEventType,
    defaultEventStatus,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    openPersistedEventEditor: (calendarEvent, forcedDirtyFields) =>
      openPersistedEventEditorDelegate(calendarEvent, forcedDirtyFields),
  })
  const workHours = ref<WorkHourWeekItem | null>(null)
  const {
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
  } = useSaplingCalendarNavigation(calendarType, workHours)
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
    queueScrollToCurrentTime(0)
  }
  const eventEditor = useSaplingEventEditor({
    events,
    templates,
    selectedPeople: selectedPeoples,
    ownPerson,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    loadPersistedEvent,
    refreshVisibleEvents,
    goToDate,
    queueScrollToCurrentTime,
    clearCreatedEvent,
    clearDragSnapshot,
    consumeSuppressedEventClick,
    resetDialogInteractionState,
    restoreDragSnapshot,
  })
  openPersistedEventEditorDelegate = eventEditor.openPersistedEventEditor
  const {
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
  } = eventEditor
  const {
    closeEventContextMenu,
    closeInformationDialog,
    closeUploadDialog,
    eventContextMenu,
    eventContextMenuItems,
    eventContextMenuStyle,
    handleEventContextMenuAction,
    informationDialogItem,
    loadEventScriptButtons,
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
  const isSyncingExternalCalendar = ref(false)
  const isCalendarInitializing = ref(true)

  let stopWindowWatcher: (() => void) | null = null

  const calendarDisplayType = computed(() =>
    calendarType.value === 'workweek' ? 'week' : calendarType.value,
  )
  const isLoading = computed(() => isTranslationLoading.value || isCalendarInitializing.value)
  const calendarWeekdays = computed(() =>
    calendarType.value === 'workweek' ? WORKWEEK_DAYS : undefined,
  )
  const showWorkHourBackground = computed(() =>
    ['day', 'week', 'workweek'].includes(calendarType.value),
  )
  const currentCalendarViewLabel = computed(() => i18n.global.t(`calendar.${calendarType.value}`))
  const currentCalendarLayoutLabel = computed(() =>
    i18n.global.t(
      calendarViewMode.value === 'single' ? 'calendar.combined' : 'calendar.sideBySide',
    ),
  )
  const calendarSyncProvider = computed<CalendarSyncProvider | null>(() => {
    const personType = ownPerson.value?.type ?? currentPersonStore.person?.type
    const typeHandle = typeof personType === 'string' ? personType : personType?.handle

    return typeHandle === 'azure' || typeHandle === 'google' ? typeHandle : null
  })

  //#endregion

  //#region Lifecycle
  stopWindowWatcher = windowWatcher.onChange((size) => {
    const isSmall = size === 'small'
    isNarrowScreen.value = isSmall

    if (isSmall) {
      calendarType.value = 'day'
      calendarViewMode.value = 'single'
      return
    }

    if (calendarType.value === 'day') {
      calendarType.value = 'workweek'
    }
  })

  onMounted(async () => {
    isCalendarInitializing.value = true

    try {
      await Promise.all([
        loadTranslations(),
        currentPermissionStore.fetchCurrentPermission(),
        loadOwnPerson(),
        loadEventDefaults(),
        loadEventEntity(),
        loadEventScriptButtons(),
        loadTemplates(),
        loadWorkHours(),
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
      await loadSelectedPeopleDetails()
      await refreshVisibleEvents()
    },
    { deep: true },
  )

  watch([calendarType, calendarViewMode, value], () => {
    void nextTick(() => {
      queueScrollToCurrentTime()
    })
  })

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
    () => route.query.open,
    () => {
      if (isCalendarInitializing.value) {
        return
      }

      void openEventFromRoute()
    },
  )
  //#endregion

  //#region Loading
  /**
   * Loads the signed-in person and initializes the default participant filter.
   */
  async function loadOwnPerson() {
    await currentPersonStore.fetchCurrentPerson()
    ownPerson.value = currentPersonStore.person

    if (typeof ownPerson.value?.handle === 'number') {
      peopleMap.value[ownPerson.value.handle] = ownPerson.value
    }

    selectedPeoples.value = ownPerson.value?.handle != null ? [ownPerson.value.handle] : []
  }

  /**
   * Loads the event templates used by the shared edit dialog.
   */
  async function loadTemplates() {
    templates.value = await ApiTemplateService.getEntityTemplate('event')
  }

  async function loadEventDefaults() {
    const [typeResponse, statusResponse] = await Promise.all([
      ApiGenericService.find<EventTypeItem>('eventType', {
        filter: { handle: DEFAULT_EVENT_TYPE_HANDLE },
        limit: 1,
        page: 1,
      }),
      ApiGenericService.find<EventStatusItem>('eventStatus', {
        filter: { handle: DEFAULT_EVENT_STATUS_HANDLE },
        limit: 1,
        page: 1,
      }),
    ])

    defaultEventType.value = typeResponse.data[0] ?? null
    defaultEventStatus.value = statusResponse.data[0] ?? null
  }

  /**
   * Loads the entity metadata for the event dialog.
   */
  async function loadEventEntity() {
    entityEvent.value =
      (
        await ApiGenericService.find<EntityItem>('entity', {
          filter: { handle: 'event' },
          limit: 1,
          page: 1,
        })
      ).data[0] || null
  }

  /**
   * Loads the user's work week to render working-hour background blocks.
   */
  async function loadWorkHours() {
    workHours.value = await ApiCurrentService.getWorkWeek()
  }

  function getPersonWorkHours(personId: number): WorkHourWeekItem | null {
    const ownPersonHandle = ownPerson.value?.handle
    const person =
      peopleMap.value[personId] ?? (personId === ownPersonHandle ? ownPerson.value : null)
    const personWorkWeek =
      typeof person?.workWeek === 'object' && person.workWeek ? person.workWeek : null

    if (personWorkWeek) {
      return personWorkWeek
    }

    const companyWorkWeek =
      typeof person?.company?.workWeek === 'object' && person.company.workWeek
        ? person.company.workWeek
        : null

    if (companyWorkWeek) {
      return companyWorkWeek
    }

    return personId === ownPersonHandle ? workHours.value : null
  }

  async function syncExternalCalendar() {
    if (
      !calendarDateRange.value ||
      isSyncingExternalCalendar.value ||
      !calendarSyncProvider.value
    ) {
      return
    }

    isSyncingExternalCalendar.value = true
    const provider = calendarSyncProvider.value

    const startDate = parseLocalCalendarDate(calendarDateRange.value.start.date)
    startDate.setHours(0, 0, 0, 0)

    const endDate = parseLocalCalendarDate(calendarDateRange.value.end.date)
    endDate.setHours(23, 59, 59, 999)

    try {
      const result: CalendarImportResult = await ApiCalendarService.importEvents(provider, {
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
      })

      await refreshVisibleEvents()
      pushMessage(
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
  //#endregion

  //#region Events
  /**
   * Updates the selected people from the filter drawer.
   */
  function onSelectedPeoplesUpdate(values: string[]) {
    selectedPeoples.value = values
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => !Number.isNaN(value))
  }

  //#region Return
  return {
    forceEditDialogDirtyFields,
    calendarScrollContainer,
    calendarDisplayType,
    calendarType,
    calendarTypeOptions: CALENDAR_TYPE_OPTIONS,
    calendarViewMode,
    calendarMode,
    calendarSyncProvider,
    calendarWeekdays,
    createEvent,
    currentCalendarLayoutLabel,
    currentDateRangeLabel,
    currentCalendarViewLabel,
    currentMonthLabel,
    eventContextMenu,
    eventContextMenuItems,
    eventContextMenuStyle,
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
    isSyncingExternalCalendar,
    isNarrowScreen,
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
    closeUploadDialog,
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
