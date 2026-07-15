import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import type { EntityItem, EventItem } from '@/entity/entity'
import type { EntityTemplate } from '@/entity/structure'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useSaplingEventContextMenu } from '../useSaplingEventContextMenu'

function createHarness() {
  const templates = ref<EntityTemplate[]>([])
  const entityEvent = ref<EntityItem | null>({
    handle: 'event',
    canRead: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true,
    canShow: true,
  } as EntityItem)
  const editEvent = ref<CalendarEvent | null>(null)
  const showEditDialog = ref(false)
  const forceEditDialogDirtyFields = ref(['startDate'])
  const clearDragSnapshot = vi.fn()
  const loadPersistedEvent = vi.fn(async () => null as EventItem | null)
  const refreshVisibleEvents = vi.fn(async () => undefined)
  const menu = useSaplingEventContextMenu({
    templates,
    entityEvent,
    editEvent,
    showEditDialog,
    forceEditDialogDirtyFields,
    clearDragSnapshot,
    loadPersistedEvent,
    refreshVisibleEvents,
  })

  return {
    clearDragSnapshot,
    editEvent,
    forceEditDialogDirtyFields,
    loadPersistedEvent,
    menu,
    showEditDialog,
    templates,
  }
}

function createEventItem(overrides: Partial<EventItem> = {}): EventItem {
  return {
    handle: 42,
    title: 'Planning',
    startDate: '2026-07-15T09:00:00.000Z',
    endDate: '2026-07-15T10:00:00.000Z',
    isAllDay: false,
    ...overrides,
  } as EventItem
}

describe('useSaplingEventContextMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('hydrates and positions the menu from the persisted event', async () => {
    const harness = createHarness()
    const persistedItem = createEventItem({ title: 'Persisted title' })
    harness.loadPersistedEvent.mockResolvedValue(persistedItem)
    const calendarEvent = {
      start: Date.now(),
      end: Date.now() + 3_600_000,
      timed: true,
      event: createEventItem(),
    } as CalendarEvent

    await harness.menu.openEventContextMenu(
      new MouseEvent('contextmenu', { clientX: 120, clientY: 75 }),
      calendarEvent,
    )
    await nextTick()

    expect(harness.loadPersistedEvent).toHaveBeenCalledWith(42)
    expect(harness.menu.eventContextMenu.value).toMatchObject({
      visible: true,
      item: persistedItem,
      x: 120,
      y: 75,
    })
  })

  it('opens a clean copy without handle or unique fields', async () => {
    const harness = createHarness()
    harness.templates.value = [
      { name: 'handle' },
      { name: 'externalId', isUnique: true },
    ] as EntityTemplate[]
    harness.menu.eventContextMenu.value.item = createEventItem({
      externalId: 'EXT-42',
    } as Partial<EventItem>)

    await harness.menu.handleEventContextMenuAction({ type: 'copy', icon: 'mdi-content-copy' })

    expect(harness.editEvent.value?.event).toMatchObject({ title: 'Planning' })
    expect(harness.editEvent.value?.event?.handle).toBeUndefined()
    expect(harness.editEvent.value?.event?.externalId).toBeUndefined()
    expect(harness.forceEditDialogDirtyFields.value).toEqual([])
    expect(harness.clearDragSnapshot).toHaveBeenCalledTimes(1)
    expect(harness.showEditDialog.value).toBe(true)
  })

  it('opens information only when the current user has read permission', async () => {
    const harness = createHarness()
    const item = createEventItem()
    harness.menu.eventContextMenu.value.item = item

    await harness.menu.handleEventContextMenuAction({
      type: 'showInformation',
      icon: 'mdi-information-outline',
    })
    expect(harness.menu.showInformationDialog.value).toBe(false)

    useCurrentPermissionStore().accumulatedPermission = [
      {
        entityHandle: 'information',
        allowRead: true,
        allowInsert: false,
        allowUpdate: false,
        allowDelete: false,
        allowShow: true,
      },
    ]
    await harness.menu.handleEventContextMenuAction({
      type: 'showInformation',
      icon: 'mdi-information-outline',
    })

    expect(harness.menu.informationDialogItem.value).toEqual(item)
    expect(harness.menu.showInformationDialog.value).toBe(true)
  })

  it('projects the shared menu without edit, show, or delete actions', () => {
    const harness = createHarness()
    harness.menu.eventContextMenu.value.item = createEventItem()

    const actionTypes = harness.menu.eventContextMenuItems.value
      .flatMap((group) => (Array.isArray(group) ? group : [group]))
      .map((item) => item.type)

    expect(actionTypes).not.toContain('edit')
    expect(actionTypes).not.toContain('show')
    expect(actionTypes).not.toContain('delete')
    expect(actionTypes).toContain('copy')
    expect(actionTypes).toContain('timeline')
  })
})
