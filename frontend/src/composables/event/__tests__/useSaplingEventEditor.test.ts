import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { EventItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingCalendarEvent } from '../eventCalendar.utils'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  createReference: vi.fn(),
  getGenericUpdateConflict: vi.fn(() => null),
  route: { query: {} as Record<string, unknown> },
  update: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
}))

vi.mock('@/services/api.generic.service', () => ({
  default: {
    create: mocks.create,
    createReference: mocks.createReference,
    update: mocks.update,
  },
  getGenericUpdateConflict: mocks.getGenericUpdateConflict,
}))

import { useSaplingEventEditor } from '../useSaplingEventEditor'

function createEventItem(overrides: Partial<EventItem> = {}): EventItem {
  return {
    handle: 42,
    title: 'Planning',
    startDate: '2026-07-15T09:00:00.000Z',
    endDate: '2026-07-15T10:00:00.000Z',
    isAllDay: false,
    ...overrides,
  } as unknown as EventItem
}

function createHarness() {
  const events = ref<SaplingCalendarEvent[]>([])
  const templates = ref<EntityTemplate[]>([])
  const editEvent = ref<CalendarEvent | null>(null)
  const showEditDialog = ref(false)
  const forceEditDialogDirtyFields = ref<string[]>([])
  const loadPersistedEvent = vi.fn(async () => null as EventItem | null)
  const refreshVisibleEvents = vi.fn(async () => undefined)
  const goToDate = vi.fn()
  const queueScrollToCurrentTime = vi.fn()
  const queueScrollToTime = vi.fn()
  const clearCreatedEvent = vi.fn()
  const clearDragSnapshot = vi.fn()
  const consumeSuppressedEventClick = vi.fn(() => false)
  const resetDialogInteractionState = vi.fn()
  const restoreDragSnapshot = vi.fn()
  const editor = useSaplingEventEditor({
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

  return {
    clearDragSnapshot,
    editEvent,
    editor,
    forceEditDialogDirtyFields,
    goToDate,
    loadPersistedEvent,
    queueScrollToCurrentTime,
    queueScrollToTime,
    refreshVisibleEvents,
    resetDialogInteractionState,
    restoreDragSnapshot,
    showEditDialog,
  }
}

describe('useSaplingEventEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.create.mockReset()
    mocks.createReference.mockReset()
    mocks.getGenericUpdateConflict.mockReset().mockReturnValue(null)
    mocks.route.query = {}
    mocks.update.mockReset()
  })

  it('hydrates persisted data while preserving dragged times and dirty fields', async () => {
    const harness = createHarness()
    harness.loadPersistedEvent.mockResolvedValue(createEventItem())
    const draggedEvent = {
      start: new Date(2026, 6, 15, 11).getTime(),
      end: new Date(2026, 6, 15, 12).getTime(),
      event: { handle: 42 },
      timed: true,
    } as CalendarEvent

    await harness.editor.openPersistedEventEditor(draggedEvent, ['startDate', 'endDate'])

    expect(harness.editEvent.value?.start).toBe(draggedEvent.start)
    expect(harness.editEvent.value?.end).toBe(draggedEvent.end)
    expect(harness.forceEditDialogDirtyFields.value).toEqual(['startDate', 'endDate'])
    expect(harness.clearDragSnapshot).not.toHaveBeenCalled()
    expect(harness.showEditDialog.value).toBe(true)
  })

  it('opens the canonical series start when a later recurrence occurrence is clicked', async () => {
    const harness = createHarness()
    harness.loadPersistedEvent.mockResolvedValue(
      createEventItem({ recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=2' }),
    )
    const laterOccurrence = {
      start: new Date('2026-07-16T09:00:00.000Z').getTime(),
      end: new Date('2026-07-16T10:00:00.000Z').getTime(),
      event: {
        handle: 42,
        recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=2',
      },
      timed: true,
      isRecurringOccurrence: true,
      recurrenceOccurrenceStart: '2026-07-16T09:00:00.000Z',
      recurrenceOccurrenceEnd: '2026-07-16T10:00:00.000Z',
    } as CalendarEvent

    await harness.editor.openPersistedEventEditor(laterOccurrence, [])

    expect(harness.editEvent.value?.start).toBe(new Date('2026-07-15T09:00:00.000Z').getTime())
    expect(harness.editEvent.value?.end).toBe(new Date('2026-07-15T10:00:00.000Z').getTime())
    expect(harness.forceEditDialogDirtyFields.value).toEqual([])
  })

  it('applies a dragged occurrence delta to the canonical series start', async () => {
    const harness = createHarness()
    harness.loadPersistedEvent.mockResolvedValue(
      createEventItem({ recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=2' }),
    )
    const draggedOccurrence = {
      start: new Date('2026-07-16T11:00:00.000Z').getTime(),
      end: new Date('2026-07-16T12:00:00.000Z').getTime(),
      event: {
        handle: 42,
        recurrenceRule: 'FREQ=DAILY;INTERVAL=1;COUNT=2',
      },
      timed: true,
      isRecurringOccurrence: true,
      recurrenceOccurrenceStart: '2026-07-16T09:00:00.000Z',
      recurrenceOccurrenceEnd: '2026-07-16T10:00:00.000Z',
    } as CalendarEvent

    await harness.editor.openPersistedEventEditor(draggedOccurrence, ['startDate', 'endDate'])

    expect(harness.editEvent.value?.start).toBe(new Date('2026-07-15T11:00:00.000Z').getTime())
    expect(harness.editEvent.value?.end).toBe(new Date('2026-07-15T12:00:00.000Z').getTime())
  })

  it('ignores derived preparation and follow-up placeholders', async () => {
    const harness = createHarness()
    const placeholder = {
      start: 1,
      end: 2,
      timed: true,
      saplingSource: 'eventBuffer',
      event: {
        bufferKind: 'preparation',
        parentEventHandle: 42,
        title: 'Vorbereitung: Planning',
        isAllDay: false,
      },
    } as SaplingCalendarEvent

    await harness.editor.openEventEditor(placeholder)

    expect(harness.loadPersistedEvent).not.toHaveBeenCalled()
    expect(harness.showEditDialog.value).toBe(false)
  })

  it('opens a route-selected event once and aligns the calendar date', async () => {
    mocks.route.query = { open: '42' }
    const harness = createHarness()
    harness.loadPersistedEvent.mockResolvedValue(createEventItem())

    await expect(harness.editor.openEventFromRoute()).resolves.toBe(true)
    await expect(harness.editor.openEventFromRoute()).resolves.toBe(false)

    expect(harness.loadPersistedEvent).toHaveBeenCalledTimes(1)
    expect(harness.goToDate).toHaveBeenCalledWith('2026-07-15T09:00:00.000Z')
    expect(harness.resetDialogInteractionState).toHaveBeenCalledTimes(1)
    expect(harness.queueScrollToCurrentTime).not.toHaveBeenCalled()
    expect(harness.queueScrollToTime).toHaveBeenCalledWith('2026-07-15T09:00:00.000Z')
  })

  it('does not reopen a dragged event from the synchronized route and clear its dirty fields', async () => {
    const harness = createHarness()
    harness.loadPersistedEvent.mockResolvedValue(createEventItem())
    const draggedEvent = {
      start: new Date(2026, 6, 15, 11).getTime(),
      end: new Date(2026, 6, 15, 12).getTime(),
      event: { handle: 42 },
      timed: true,
    } as CalendarEvent

    await harness.editor.openPersistedEventEditor(draggedEvent, ['startDate', 'endDate'])
    mocks.route.query = { open: '42' }

    await expect(harness.editor.openEventFromRoute()).resolves.toBe(false)

    expect(harness.loadPersistedEvent).toHaveBeenCalledTimes(1)
    expect(harness.forceEditDialogDirtyFields.value).toEqual(['startDate', 'endDate'])
    expect(harness.editEvent.value?.start).toBe(draggedEvent.start)
    expect(harness.editEvent.value?.end).toBe(draggedEvent.end)
  })

  it('restores the drag snapshot and refreshes when editing is cancelled', async () => {
    const harness = createHarness()
    harness.editEvent.value = { start: 1, end: 2 } as CalendarEvent
    harness.showEditDialog.value = true

    await harness.editor.onEditDialogCancel()

    expect(harness.restoreDragSnapshot).toHaveBeenCalledTimes(1)
    expect(harness.refreshVisibleEvents).toHaveBeenCalledTimes(1)
    expect(harness.editEvent.value).toBeNull()
    expect(harness.showEditDialog.value).toBe(false)
  })

  it('keeps a copied event draft when the dialog switches to create mode', () => {
    const harness = createHarness()
    const copiedEvent = createEventItem({ handle: undefined, title: 'Planning copy' })

    harness.editor.onEditDialogItemUpdate(copiedEvent)
    harness.editor.onEditDialogModeUpdate('create')

    expect(harness.editEvent.value).toEqual(
      expect.objectContaining({
        name: 'Planning copy',
        event: expect.objectContaining({ title: 'Planning copy' }),
      }),
    )
    expect(harness.editEvent.value?.event?.handle).toBeUndefined()
  })

  it('creates a new event with only the selected participants and completes save-and-close', async () => {
    const harness = createHarness()
    const savedEvent = createEventItem()
    mocks.create.mockResolvedValue(savedEvent)
    mocks.createReference.mockResolvedValue(undefined)
    const complete = vi.fn()
    const draft = {
      start: new Date(2026, 6, 15, 9).getTime(),
      end: new Date(2026, 6, 15, 10).getTime(),
      timed: true,
      event: { participants: [7] },
    } as CalendarEvent
    harness.editEvent.value = draft
    harness.showEditDialog.value = true

    await harness.editor.onEditDialogSave(draft, 'saveAndClose', { complete })

    expect(mocks.create).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({ participants: [7] }),
    )
    expect(mocks.createReference).not.toHaveBeenCalled()
    expect(harness.refreshVisibleEvents).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledWith(true)
    expect(harness.showEditDialog.value).toBe(false)
  })

  it('keeps a deliberately emptied participant list empty when creating an event', async () => {
    const harness = createHarness()
    const savedEvent = createEventItem({ participants: [] } as Partial<EventItem>)
    mocks.create.mockResolvedValue(savedEvent)
    const draft = {
      start: new Date(2026, 6, 15, 9).getTime(),
      end: new Date(2026, 6, 15, 10).getTime(),
      timed: true,
      event: { participants: [] },
    } as CalendarEvent
    harness.editEvent.value = draft

    await harness.editor.onEditDialogSave(draft, 'saveAndClose')

    expect(mocks.create).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({ participants: [] }),
    )
  })

  it('does not replace participants when an existing event payload omits its handle', async () => {
    const harness = createHarness()
    const existingEvent = createEventItem({
      participants: [{ handle: 7 }, { handle: 9 }],
    } as Partial<EventItem>)
    const savedEvent = createEventItem({ category: { handle: 'partner' } } as Partial<EventItem>)
    mocks.update.mockResolvedValue(savedEvent)
    harness.editEvent.value = {
      event: existingEvent,
      start: new Date(existingEvent.startDate).getTime(),
      end: new Date(existingEvent.endDate).getTime(),
      timed: true,
    } as CalendarEvent
    harness.showEditDialog.value = true

    const categoryOnlyPayload = {
      category: 'partner',
      startDate: existingEvent.startDate,
      endDate: existingEvent.endDate,
    } as CalendarEvent

    await harness.editor.onEditDialogSave(categoryOnlyPayload, 'saveAndClose')

    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith(
      'event',
      42,
      expect.not.objectContaining({ participants: expect.anything() }),
      expect.any(Object),
    )
  })
})
