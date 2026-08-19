import { ref, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import ApiGenericService, {
  getGenericUpdateConflict,
  type GenericUpdateConflictDetails,
} from '@/services/api.generic.service'
import type { EventItem, PersonItem, SaplingGenericItem } from '@/entity/entity'
import type {
  DialogSaveAction,
  DialogSaveContext,
  DialogState,
  EntityTemplate,
} from '@/entity/structure'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import { isRecurringCalendarEvent } from '@/utils/eventRecurrence'
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

interface UseSaplingEventEditorOptions {
  events: Ref<SaplingCalendarEvent[]>
  templates: Ref<EntityTemplate[]>
  selectedPeople: Ref<number[]>
  ownPerson: Ref<PersonItem | null>
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

    const autoOpenKey = String(handle)
    if (lastAutoOpenedEventHandle === autoOpenKey) {
      return false
    }

    const persistedEvent = await options.loadPersistedEvent(handle)
    if (!persistedEvent) {
      return false
    }

    lastAutoOpenedEventHandle = autoOpenKey
    if (persistedEvent.startDate) {
      options.goToDate(persistedEvent.startDate)
    }

    options.editEvent.value = toCalendarEvent(persistedEvent)
    applyCalendarEventDateParts(options.editEvent.value)
    options.forceEditDialogDirtyFields.value = []
    options.resetDialogInteractionState()
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
    const isNewEvent = getCalendarEventHandle(eventPayload) == null
    const participantHandles = resolveDraftParticipants(
      updatedEvent,
      options.selectedPeople.value,
      isNewEvent ? options.ownPerson.value : null,
    )
    let savedEvent: EventItem
    let didSave = false
    let pendingRelationsPersisted = true

    try {
      if (isNewEvent) {
        eventPayload.participants = participantHandles
      }
      applyCalendarEventDateParts(eventPayload)

      const editingHandle = getCalendarEventHandle(options.editEvent.value)
      if (editingHandle == null) {
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
      await options.refreshVisibleEvents()

      if (action === 'saveAndClose' && pendingRelationsPersisted) {
        options.showEditDialog.value = false
        options.editEvent.value = null
        return
      }

      const persistedEvent = await options.loadPersistedEvent(savedEvent.handle)
      options.editEvent.value = toCalendarEvent(persistedEvent ?? savedEvent)
      options.showEditDialog.value = true
    } catch (error) {
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
    if (mode === 'create') {
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
    const handle = getCalendarEventHandle(calendarEvent)
    const persistedEvent = handle == null ? null : await options.loadPersistedEvent(handle)
    const baseEvent = persistedEvent
      ? toCalendarEvent(persistedEvent)
      : isRecurringCalendarEvent(calendarEvent) && calendarEvent.event
        ? toCalendarEvent(calendarEvent.event as EventItem)
        : calendarEvent

    options.editEvent.value = isRecurringCalendarEvent(calendarEvent)
      ? applyRecurringInteractionToSeries(baseEvent, calendarEvent, forcedDirtyFields)
      : { ...baseEvent, start: calendarEvent.start, end: calendarEvent.end }
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

  return {
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
    updateConflictDialog,
  }
}
