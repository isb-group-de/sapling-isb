import type { Ref } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { GenericUpdateConflictDetails } from '@/services/api.generic.service'
import type { EventItem, SaplingGenericItem } from '@/entity/entity'
import type { DialogSaveAction, EntityTemplate } from '@/entity/structure'
import type { SaplingCalendarEvent } from './eventCalendar.utils'

export interface UpdateConflictDialogState {
  visible: boolean
  conflict: GenericUpdateConflictDetails | null
  draftItem: SaplingGenericItem | null
  action: DialogSaveAction
  isSaving: boolean
}

export interface RecurrenceEditScopeDialogState {
  visible: boolean
  isLoading: boolean
  calendarEvent: CalendarEvent | null
  forcedDirtyFields: string[]
}

export interface DetachOccurrenceContext {
  seriesHandle: string | number
  occurrenceStart: string
  expectedUpdatedAt?: string
}

export interface UseSaplingEventEditorOptions {
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
