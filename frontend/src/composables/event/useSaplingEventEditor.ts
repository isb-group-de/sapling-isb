import { computed, ref, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import ApiGenericService, {
  getGenericUpdateConflict,
  type GenericUpdateConflictDetails,
} from '@/services/api.generic.service'
import type { EventItem, SaplingGenericItem } from '@/entity/entity'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import { expandRecurringEvent, isRecurringCalendarEvent } from '@/utils/eventRecurrence'
import ApiCalendarService from '@/services/api.calendar.service'
import {
  DEFAULT_EVENT_COLOR,
  applyCalendarEventDateParts,
  buildConcurrencyOptions,
  buildConcurrencyPayload,
  getCalendarEventHandle,
  getItemHandle,
  isReadonlyCalendarEvent,
  normalizeConcurrencyTimestamp,
  resolveDraftParticipants,
  toCalendarEvent,
  toEditableEventItem,
  type SaplingCalendarEvent,
} from './eventCalendar.utils'

interface UpdateConflictDialogState {
  visible: boolean
  conflict: GenericUpdateConflictDetails | null
  draftItem: SaplingGenericItem | null
  action: DialogSaveAction
  isSaving: boolean
}

interface RecurrenceEditScopeDialogState {
  visible: boolean
  isLoading: boolean
  calendarEvent: CalendarEvent | null
  forcedDirtyFields: string[]
}

interface DetachOccurrenceContext {
  seriesHandle: string | number
  occurrenceStart: string
  expectedUpdatedAt?: string
}

interface UseSaplingEventEditorOptions {
  events: Ref<SaplingCalendarEvent[]>
  templates: Ref<EntityTemplate[]>
  editEvent: Ref<CalendarEvent | null>
  showEditDialog: Ref<boolean>
  forceEditDialogDirtyFields: Ref<string[]>
  loadPersistedEvent: (handle: EventItem['handle']) => Promise<EventItem | null>
  refreshVisibleEvents: () => Promise<void>
  goToDate: (target: Date | string) => void
  queueScrollToCurrentTime: (delay?: number) => void
  queueScrollToTime: (target: Date | string, delay?: number) => void
  clearCreatedEvent: () => void
  clearDragSnapshot: () => void
  consumeSuppressedEventClick: () => boolean
  resetDialogInteractionState: () => void
  restoreDragSnapshot: () => void
}

/** Owns event editor persistence, route opening, and update-conflict resolution. */
export function useSaplingEventEditor(options: UseSaplingEventEditorOptions) {
  const route = useRoute()
  const changeLogDialogStore = useChangeLogDialogStore()
  const updateConflictDialog = ref<UpdateConflictDialogState>({
    visible: false,
    conflict: null,
    draftItem: null,
    action: 'save',
    isSaving: false,
  })
  const recurrenceEditScopeDialog = ref<RecurrenceEditScopeDialogState>({
    visible: false,
    isLoading: false,
    calendarEvent: null,
    forcedDirtyFields: [],
  })
  const detachOccurrenceContext = ref<DetachOccurrenceContext | null>(null)
  const isDetachingOccurrence = computed(() => detachOccurrenceContext.value !== null)
  let lastAutoOpenedEventHandle: string | null = null

  async function openEventEditor(event: CalendarEvent) {
    if (!event || isReadonlyCalendarEvent(event) || options.consumeSuppressedEventClick()) {
      return
    }
    await openPersistedEventEditor(event, [])
  }

  async function openEventFromRoute(): Promise<boolean> {
    const handle = getOpenEventHandleFromRoute()
    if (handle == null) {
      lastAutoOpenedEventHandle = null
      return false
    }

    const requestedOccurrenceStart = getOpenEventOccurrenceFromRoute()
    const autoOpenKey = requestedOccurrenceStart
      ? `${handle}:${requestedOccurrenceStart}`
      : String(handle)
    if (lastAutoOpenedEventHandle === autoOpenKey) {
      return false
    }

    const persistedEvent = await options.loadPersistedEvent(handle)
    if (!persistedEvent) {
      return false
    }

    const occurrence = requestedOccurrenceStart
      ? resolvePersistedOccurrence(persistedEvent, requestedOccurrenceStart)
      : null
    const selectedStart = occurrence ? requestedOccurrenceStart : persistedEvent.startDate

    lastAutoOpenedEventHandle = autoOpenKey
    if (selectedStart) {
      options.goToDate(selectedStart)
    }

    options.resetDialogInteractionState()
    if (occurrence) {
      await openCalendarEventEditor(occurrence, [], 'occurrence', persistedEvent)
      lastAutoOpenedEventHandle = autoOpenKey
      options.queueScrollToTime(requestedOccurrenceStart as string)
      return true
    }

    options.editEvent.value = toCalendarEvent(persistedEvent)
    applyCalendarEventDateParts(options.editEvent.value)
    options.forceEditDialogDirtyFields.value = []
    options.showEditDialog.value = true
    if (persistedEvent.startDate) {
      options.queueScrollToTime(persistedEvent.startDate)
    } else {
      options.queueScrollToCurrentTime()
    }
    return true
  }

  async function onEditDialogSave(
    updatedEvent: CalendarEvent,
    action: DialogSaveAction,
    context?: DialogSaveContext,
  ) {
    const eventPayload: CalendarEvent = { ...updatedEvent }
    // The generic edit form intentionally omits the primary key from update
    // payloads. Determine create/update mode from the canonical editor state;
    // otherwise every existing Event looks new here and its participants are
    // replaced with the currently selected calendar-filter people.
    const editingHandle = getCalendarEventHandle(options.editEvent.value)
    const isNewEvent = editingHandle == null
    // The filter selection is copied into the draft when the create dialog
    // opens. Saving only persists the draft's current participant list, so a
    // deliberately emptied list cannot fall back to the calendar filter.
    const participantHandles = resolveDraftParticipants(updatedEvent, [])
    let savedEvent: EventItem
    let didSave = false
    let pendingRelationsPersisted = true
    const wasDetachingOccurrence = detachOccurrenceContext.value !== null

    try {
      if (isNewEvent || detachOccurrenceContext.value) {
        eventPayload.participants = participantHandles
      }
      applyCalendarEventDateParts(eventPayload)

      if (detachOccurrenceContext.value) {
        const detachContext = detachOccurrenceContext.value
        const result = await ApiCalendarService.detachEventOccurrence(detachContext.seriesHandle, {
          occurrenceStart: detachContext.occurrenceStart,
          event: eventPayload as Record<string, unknown>,
          expectedUpdatedAt: detachContext.expectedUpdatedAt,
        })
        savedEvent = result.detachedEvent
        if (savedEvent.handle != null) {
          pendingRelationsPersisted =
            (await context?.persistPendingRelations?.(savedEvent.handle)) ?? true
        }
        detachOccurrenceContext.value = null
      } else if (editingHandle == null) {
        savedEvent = await ApiGenericService.create<EventItem>('event', eventPayload)
        if (savedEvent.handle != null) {
          pendingRelationsPersisted =
            (await context?.persistPendingRelations?.(savedEvent.handle)) ?? true
        }
        replaceLocalEvent(options.editEvent.value, eventPayload, savedEvent)
      } else {
        savedEvent = await ApiGenericService.update<EventItem>(
          'event',
          editingHandle,
          eventPayload,
          {
            concurrency: buildConcurrencyOptions(
              options.templates.value,
              toEditableEventItem(options.editEvent.value),
            ),
            suppressConflictMessage: true,
          },
        )
        replaceLocalEvent(options.editEvent.value, updatedEvent, savedEvent)
      }

      didSave = true
      options.clearCreatedEvent()
      options.forceEditDialogDirtyFields.value = []
      options.clearDragSnapshot()

      if (action === 'saveAndClose' && pendingRelationsPersisted) {
        options.showEditDialog.value = false
        options.editEvent.value = null
        await options.refreshVisibleEvents()
        return
      }

      await options.refreshVisibleEvents()
      const persistedEvent = await options.loadPersistedEvent(savedEvent.handle)
      options.editEvent.value = toCalendarEvent(persistedEvent ?? savedEvent)
      options.showEditDialog.value = true
    } catch (error) {
      if (wasDetachingOccurrence) {
        return
      }
      const conflict = getGenericUpdateConflict(error)
      if (conflict) {
        updateConflictDialog.value = {
          visible: true,
          conflict,
          draftItem: eventPayload as SaplingGenericItem,
          action,
          isSaving: false,
        }
      }
    } finally {
      context?.complete(didSave)
    }
  }

  async function onEditDialogCancel() {
    options.restoreDragSnapshot()
    options.showEditDialog.value = false
    options.editEvent.value = null
    options.forceEditDialogDirtyFields.value = []
    detachOccurrenceContext.value = null
    await options.refreshVisibleEvents()
  }

  function closeUpdateConflictDialog() {
    updateConflictDialog.value = {
      visible: false,
      conflict: null,
      draftItem: null,
      action: 'save',
      isSaving: false,
    }
  }

  function handleUpdateConflictVisibility(value: boolean) {
    if (!value) {
      closeUpdateConflictDialog()
      return
    }
    updateConflictDialog.value = { ...updateConflictDialog.value, visible: true }
  }

  function openUpdateConflictChangeLog() {
    const conflict = updateConflictDialog.value.conflict
    if (conflict) {
      changeLogDialogStore.openChangeLog(conflict.entityHandle, String(conflict.handle))
    }
  }

  async function reloadUpdateConflictRecord() {
    const conflict = updateConflictDialog.value.conflict
    const handle = getItemHandle(conflict?.current) ?? conflict?.handle
    if (typeof handle !== 'number') {
      closeUpdateConflictDialog()
      return
    }

    const currentItem = await options.loadPersistedEvent(handle)
    if (currentItem) {
      options.editEvent.value = toCalendarEvent(currentItem)
      applyCalendarEventDateParts(options.editEvent.value)
      options.forceEditDialogDirtyFields.value = []
      options.clearDragSnapshot()
      options.showEditDialog.value = true
      await options.refreshVisibleEvents()
    }
    closeUpdateConflictDialog()
  }

  async function mergeUpdateConflict(mergedItem: SaplingGenericItem) {
    const state = updateConflictDialog.value
    const conflict = state.conflict
    if (!conflict || state.isSaving) {
      return
    }

    const handle = getItemHandle(conflict.current) ?? conflict.handle
    if (handle == null) {
      return
    }
    updateConflictDialog.value = { ...state, isSaving: true }

    try {
      const savedEvent = await ApiGenericService.update<EventItem>('event', handle, mergedItem, {
        concurrency: {
          expectedUpdatedAt:
            conflict.currentUpdatedAt ?? normalizeConcurrencyTimestamp(conflict.current?.updatedAt),
          basePayload: buildConcurrencyPayload(options.templates.value, conflict.current ?? null),
          resolution: 'detect',
        },
        suppressConflictMessage: true,
      })

      replaceLocalEvent(options.editEvent.value, toCalendarEvent(savedEvent), savedEvent)
      options.clearCreatedEvent()
      options.forceEditDialogDirtyFields.value = []
      options.clearDragSnapshot()
      await options.refreshVisibleEvents()
      closeUpdateConflictDialog()

      if (state.action === 'saveAndClose') {
        options.showEditDialog.value = false
        options.editEvent.value = null
        return
      }

      const persistedEvent = await options.loadPersistedEvent(savedEvent.handle)
      options.editEvent.value = toCalendarEvent(persistedEvent ?? savedEvent)
      applyCalendarEventDateParts(options.editEvent.value)
      options.showEditDialog.value = true
    } catch (error) {
      const nextConflict = getGenericUpdateConflict(error)
      updateConflictDialog.value = nextConflict
        ? {
            ...state,
            visible: true,
            conflict: nextConflict,
            draftItem: mergedItem,
            isSaving: false,
          }
        : { ...state, isSaving: false }
    }
  }

  function onEditDialogModeUpdate(mode: DialogState) {
    if (detachOccurrenceContext.value) {
      return
    }
    if (mode === 'create' && getCalendarEventHandle(options.editEvent.value) != null) {
      options.editEvent.value = null
    }
  }

  function onEditDialogItemUpdate(item: SaplingGenericItem | null) {
    options.editEvent.value = item ? toCalendarEvent(item as EventItem) : null
  }

  function replaceLocalEvent(
    targetEvent: CalendarEvent | null,
    baseEvent: CalendarEvent,
    savedEvent: EventItem,
  ) {
    if (!targetEvent || savedEvent.recurrenceRule || isRecurringCalendarEvent(targetEvent)) {
      return
    }
    const index = options.events.value.indexOf(targetEvent)
    if (index === -1) {
      return
    }

    options.events.value[index] = {
      ...baseEvent,
      ...savedEvent,
      event: savedEvent,
      name: savedEvent.title,
      color: savedEvent.type?.color || DEFAULT_EVENT_COLOR,
      start: new Date(savedEvent.startDate).getTime() || 0,
      end: new Date(savedEvent.endDate).getTime() || 0,
      timed: savedEvent.isAllDay === false,
    }
  }

  async function openPersistedEventEditor(
    calendarEvent: CalendarEvent,
    forcedDirtyFields: string[],
  ) {
    if (isRecurringCalendarEvent(calendarEvent)) {
      recurrenceEditScopeDialog.value = {
        visible: true,
        isLoading: false,
        calendarEvent,
        forcedDirtyFields: [...forcedDirtyFields],
      }
      return
    }

    await openCalendarEventEditor(calendarEvent, forcedDirtyFields, 'series')
  }

  async function chooseRecurrenceEditSeries() {
    await resolveRecurrenceEditScope('series')
  }

  async function chooseRecurrenceEditOccurrence() {
    await resolveRecurrenceEditScope('occurrence')
  }

  function closeRecurrenceEditScopeDialog() {
    if (recurrenceEditScopeDialog.value.isLoading) {
      return
    }
    recurrenceEditScopeDialog.value = {
      visible: false,
      isLoading: false,
      calendarEvent: null,
      forcedDirtyFields: [],
    }
    options.restoreDragSnapshot()
  }

  async function resolveRecurrenceEditScope(scope: 'series' | 'occurrence') {
    const state = recurrenceEditScopeDialog.value
    if (!state.calendarEvent || state.isLoading) {
      return
    }
    recurrenceEditScopeDialog.value = { ...state, isLoading: true }
    try {
      await openCalendarEventEditor(state.calendarEvent, state.forcedDirtyFields, scope)
      recurrenceEditScopeDialog.value = {
        visible: false,
        isLoading: false,
        calendarEvent: null,
        forcedDirtyFields: [],
      }
    } finally {
      if (recurrenceEditScopeDialog.value.visible) {
        recurrenceEditScopeDialog.value = {
          ...recurrenceEditScopeDialog.value,
          isLoading: false,
        }
      }
    }
  }

  async function openCalendarEventEditor(
    calendarEvent: CalendarEvent,
    forcedDirtyFields: string[],
    scope: 'series' | 'occurrence',
    loadedPersistedEvent?: EventItem | null,
  ) {
    const handle = getCalendarEventHandle(calendarEvent)
    const persistedEvent =
      loadedPersistedEvent === undefined
        ? handle == null
          ? null
          : await options.loadPersistedEvent(handle)
        : loadedPersistedEvent
    const baseEvent = persistedEvent
      ? toCalendarEvent(persistedEvent)
      : isRecurringCalendarEvent(calendarEvent) && calendarEvent.event
        ? toCalendarEvent(calendarEvent.event as EventItem)
        : calendarEvent

    if (scope === 'occurrence' && persistedEvent && handle != null) {
      const occurrence = calendarEvent as CalendarEvent & {
        recurrenceOccurrenceStart?: string
      }
      if (!occurrence.recurrenceOccurrenceStart) {
        return
      }
      const detachedItem: EventItem = {
        ...persistedEvent,
        handle: undefined,
        recurrenceRule: null,
        recurrenceExceptionDates: [],
        startDate: new Date(calendarEvent.start),
        endDate: new Date(calendarEvent.end),
      }
      options.editEvent.value = {
        ...toCalendarEvent(detachedItem),
        start: calendarEvent.start,
        end: calendarEvent.end,
      }
      detachOccurrenceContext.value = {
        seriesHandle: handle,
        occurrenceStart: occurrence.recurrenceOccurrenceStart,
        expectedUpdatedAt: normalizeConcurrencyTimestamp(persistedEvent.updatedAt) ?? undefined,
      }
    } else {
      detachOccurrenceContext.value = null
      options.editEvent.value = isRecurringCalendarEvent(calendarEvent)
        ? applyRecurringInteractionToSeries(baseEvent, calendarEvent, forcedDirtyFields)
        : { ...baseEvent, start: calendarEvent.start, end: calendarEvent.end }
    }
    applyCalendarEventDateParts(options.editEvent.value)
    options.forceEditDialogDirtyFields.value = forcedDirtyFields
    if (forcedDirtyFields.length === 0) {
      options.clearDragSnapshot()
    }
    // Opening the editor synchronizes the handle into the route. Mark this
    // handle as handled before the route watcher runs, otherwise it opens the
    // same record a second time and clears calendar-interaction dirty fields.
    if (handle != null) {
      lastAutoOpenedEventHandle = String(handle)
    }
    options.showEditDialog.value = true
  }

  function applyRecurringInteractionToSeries(
    baseEvent: CalendarEvent,
    occurrence: CalendarEvent,
    forcedDirtyFields: string[],
  ): CalendarEvent {
    const result = { ...baseEvent }
    if (forcedDirtyFields.length === 0) {
      return result
    }

    const recurringOccurrence = occurrence as CalendarEvent & {
      recurrenceOccurrenceStart?: string
      recurrenceOccurrenceEnd?: string
    }
    const occurrenceStart = recurringOccurrence.recurrenceOccurrenceStart
      ? new Date(recurringOccurrence.recurrenceOccurrenceStart).getTime()
      : Number.NaN
    const occurrenceEnd = recurringOccurrence.recurrenceOccurrenceEnd
      ? new Date(recurringOccurrence.recurrenceOccurrenceEnd).getTime()
      : Number.NaN

    if (
      forcedDirtyFields.includes('startDate') &&
      Number.isFinite(occurrenceStart) &&
      typeof occurrence.start === 'number'
    ) {
      const startDelta = occurrence.start - occurrenceStart
      result.start = Number(result.start) + startDelta
      result.end = Number(result.end) + startDelta
    }

    if (
      forcedDirtyFields.includes('endDate') &&
      !forcedDirtyFields.includes('startDate') &&
      Number.isFinite(occurrenceEnd) &&
      typeof occurrence.end === 'number'
    ) {
      result.end = Number(result.end) + occurrence.end - occurrenceEnd
    }

    return result
  }

  function getOpenEventHandleFromRoute(): number | null {
    const value = Array.isArray(route.query.open) ? route.query.open[0] : route.query.open
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null
    }
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  function getOpenEventOccurrenceFromRoute(): string | null {
    const value = Array.isArray(route.query.occurrence)
      ? route.query.occurrence[0]
      : route.query.occurrence
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null
    }

    const occurrenceStart = new Date(value)
    return Number.isFinite(occurrenceStart.getTime()) ? occurrenceStart.toISOString() : null
  }

  function resolvePersistedOccurrence(
    event: EventItem,
    occurrenceStart: string,
  ): CalendarEvent | null {
    if (!event.recurrenceRule) {
      return null
    }

    const occurrenceDate = new Date(occurrenceStart)
    return (
      expandRecurringEvent(event, occurrenceDate, occurrenceDate).find(
        (occurrence) => occurrence.recurrenceOccurrenceStart === occurrenceStart,
      ) ?? null
    )
  }

  return {
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
    openPersistedEventEditor,
    openUpdateConflictChangeLog,
    reloadUpdateConflictRecord,
    recurrenceEditScopeDialog,
    isDetachingOccurrence,
    updateConflictDialog,
  }
}
