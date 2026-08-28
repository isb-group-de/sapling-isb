import { computed, nextTick, ref, type CSSProperties, type Ref } from 'vue'
import type { CalendarEvent } from 'vuetify/lib/components/VCalendar/types.mjs'
import ApiGenericService from '@/services/api.generic.service'
import ApiCalendarService from '@/services/api.calendar.service'
import ApiScriptService from '@/services/api.script.service'
import type { EntityItem, EventItem, SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import type { AccumulatedPermission, EntityTemplate } from '@/entity/structure'
import { NAVIGATION_URL } from '@/constants/project.constants'
import { useCurrentPersonStore } from '@/stores/currentPersonStore'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useTimelineDialogStore } from '@/stores/timelineDialogStore'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { useSaplingMessageCenter } from '@/composables/system/useSaplingMessageCenter'
import {
  getSaplingContextMenuTableItems,
  type SaplingContextMenuTableMenuEntry,
  type SaplingContextMenuTableMenuItem,
} from '@/composables/context/useSaplingContextMenuTable'
import { i18n } from '@/i18n'
import { buildMailMenuActions, loadCustomerContactMailActions } from '@/utils/saplingMailMenuUtil'
import { buildTableOrderBy } from '@/utils/saplingTableUtil'
import {
  buildScriptButtonExecutionKey,
  handleScriptResultClient,
  pushScriptButtonAlreadyRunningMessage,
  pushScriptButtonStartedMessage,
} from '@/utils/saplingScriptResultUtil'
import { openDocumentView, openDvelopUploadDialog } from '@/utils/saplingDocumentActionUtil'
import {
  applyCalendarEventDateParts,
  toCalendarEvent,
  toPersistedEventItem,
} from '@/composables/event/eventCalendar.utils'
import { createSaplingRecordCopy } from '@/utils/saplingRecordCopy'

interface EventContextMenuState {
  visible: boolean
  item: EventItem | null
  x: number
  y: number
}

interface MaterializeRecurrenceDialogState {
  visible: boolean
  item: EventItem | null
  isSubmitting: boolean
}

interface UseSaplingEventContextMenuOptions {
  templates: Ref<EntityTemplate[]>
  entityEvent: Ref<EntityItem | null>
  editEvent: Ref<CalendarEvent | null>
  showEditDialog: Ref<boolean>
  forceEditDialogDirtyFields: Ref<string[]>
  clearDragSnapshot: () => void
  loadPersistedEvent: (handle: EventItem['handle']) => Promise<EventItem | null>
  refreshVisibleEvents: () => Promise<void>
}

/**
 * Owns the event calendar's record context menu and the auxiliary dialogs it
 * opens. Calendar loading and editor persistence stay behind injected callbacks,
 * while generic record actions remain consistent with table context menus.
 */
export function useSaplingEventContextMenu(options: UseSaplingEventContextMenuOptions) {
  const currentPersonStore = useCurrentPersonStore()
  const currentPermissionStore = useCurrentPermissionStore()
  const timelineDialogStore = useTimelineDialogStore()
  const changeLogDialogStore = useChangeLogDialogStore()
  const { openMailDialog } = useSaplingMailDialog()
  const { pushMessage } = useSaplingMessageCenter()

  const eventContextMenu = ref<EventContextMenuState>({
    visible: false,
    item: null,
    x: 0,
    y: 0,
  })
  const materializeRecurrenceDialog = ref<MaterializeRecurrenceDialogState>({
    visible: false,
    item: null,
    isSubmitting: false,
  })
  const showUploadDialog = ref(false)
  const uploadDialogItem = ref<SaplingGenericItem | null>(null)
  const showInformationDialog = ref(false)
  const informationDialogItem = ref<SaplingGenericItem | null>(null)
  const loadedScriptButtons = ref<ScriptButtonItem[]>([])
  const customerContactMailActions = ref<ReturnType<typeof buildMailMenuActions>>([])
  const runningScriptButtonKeys = new Set<string>()
  let scriptButtonsRequestId = 0

  const eventEntityPermission = computed<AccumulatedPermission | null>(() => {
    if (!options.entityEvent.value?.handle) {
      return null
    }

    return {
      entityHandle: options.entityEvent.value.handle,
      allowRead: options.entityEvent.value.canRead === true,
      allowInsert: options.entityEvent.value.canInsert === true,
      allowUpdate: options.entityEvent.value.canUpdate === true,
      allowDelete: options.entityEvent.value.canDelete === true,
      allowShow: options.entityEvent.value.canShow === true,
    }
  })
  const canNavigate = computed(() =>
    options.templates.value.some((template) => template.options?.includes('isNavigation')),
  )
  const canShowInformation = computed(
    () =>
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === 'information' && permission.allowRead,
      ) ?? false,
  )
  const eventContextMenuStyle = computed<CSSProperties>(() => ({
    top: `${eventContextMenu.value.y}px`,
    left: `${eventContextMenu.value.x}px`,
  }))
  const eventContextMenuMailActions = computed(() => [
    ...buildMailMenuActions(options.templates.value, eventContextMenu.value.item),
    ...customerContactMailActions.value,
  ])
  const eventContextMenuItems = computed<SaplingContextMenuTableMenuEntry[]>(() => {
    if (!eventContextMenu.value.item) {
      return []
    }

    const groups = getSaplingContextMenuTableItems({
      canChangeLog: true,
      canShowInformation: canShowInformation.value,
      entityPermission: eventEntityPermission.value,
      canNavigate: canNavigate.value,
      canTimeline: true,
      scriptButtons: loadedScriptButtons.value,
      mailActions: eventContextMenuMailActions.value,
      mailToLabel: i18n.global.t('global.mailTo'),
      showEdit: false,
    })
      .map((group) =>
        (Array.isArray(group) ? group : [group]).filter(
          (menuItem) => !['edit', 'show', 'delete'].includes(menuItem.type),
        ),
      )
      .filter((group) => group.length > 0)

    if (
      eventContextMenu.value.item.recurrenceRule &&
      eventEntityPermission.value?.allowInsert === true &&
      eventEntityPermission.value.allowUpdate === true
    ) {
      groups.unshift([
        {
          type: 'dissolveRecurrence',
          icon: 'mdi-calendar-remove-outline',
          title: translateCalendarLabel(
            'materializeRecurrence',
            'Wiederholung auflösen',
            'Resolve recurrence',
          ),
        },
      ])
    }

    return groups
  })

  async function loadEventScriptButtons() {
    const currentRequestId = ++scriptButtonsRequestId
    const result = await ApiGenericService.findAll<ScriptButtonItem>('scriptButton', {
      filter: { entity: { handle: 'event' } },
      orderBy: buildTableOrderBy([{ key: 'title', order: 'asc' }]),
      relations: ['m:1'],
    })

    if (currentRequestId === scriptButtonsRequestId) {
      loadedScriptButtons.value = result
    }
  }

  function closeEventContextMenu() {
    eventContextMenu.value.visible = false
  }

  async function openEventContextMenu(mouseEvent: MouseEvent, calendarEvent: CalendarEvent) {
    const targetItem = toPersistedEventItem(calendarEvent)
    if (!targetItem) {
      return
    }

    const persistedItem = await options.loadPersistedEvent(targetItem.handle)
    const menuItem = persistedItem ?? targetItem
    const canReadPerson =
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === 'person' && permission.allowRead,
      ) ?? false
    try {
      customerContactMailActions.value = await loadCustomerContactMailActions(
        options.templates.value,
        menuItem,
        canReadPerson,
      )
    } catch {
      customerContactMailActions.value = []
    }
    eventContextMenu.value.visible = false
    eventContextMenu.value.item = menuItem
    eventContextMenu.value.x = mouseEvent.clientX
    eventContextMenu.value.y = mouseEvent.clientY

    void nextTick(() => {
      eventContextMenu.value.visible = true
    })
  }

  function closeUploadDialog() {
    showUploadDialog.value = false
    uploadDialogItem.value = null
  }

  function closeInformationDialog() {
    showInformationDialog.value = false
    informationDialogItem.value = null
  }

  function closeMaterializeRecurrenceDialog() {
    if (materializeRecurrenceDialog.value.isSubmitting) {
      return
    }
    materializeRecurrenceDialog.value = {
      visible: false,
      item: null,
      isSubmitting: false,
    }
  }

  function openMaterializeRecurrenceDialog() {
    const item = eventContextMenu.value.item
    if (!item?.recurrenceRule || item.handle == null) {
      return
    }
    materializeRecurrenceDialog.value = {
      visible: true,
      item,
      isSubmitting: false,
    }
  }

  async function confirmMaterializeRecurrence() {
    const state = materializeRecurrenceDialog.value
    if (!state.item?.recurrenceRule || state.item.handle == null || state.isSubmitting) {
      return
    }

    materializeRecurrenceDialog.value = { ...state, isSubmitting: true }
    try {
      const result = await ApiCalendarService.materializeEventRecurrence(state.item.handle, {
        expectedUpdatedAt:
          state.item.updatedAt == null ? undefined : new Date(state.item.updatedAt).toISOString(),
      })
      materializeRecurrenceDialog.value = {
        visible: false,
        item: null,
        isSubmitting: false,
      }
      await options.refreshVisibleEvents()
      pushMessage(
        'success',
        translateCalendarLabel(
          'materializeRecurrenceSuccess',
          'Terminserie aufgelöst',
          'Recurring series resolved',
        ),
        translateCalendarLabel(
          'materializeRecurrenceSuccessDescription',
          `${result.materializedCount} eigenständige Termine wurden erstellt.`,
          `${result.materializedCount} standalone events were created.`,
          { count: result.materializedCount },
        ),
        'calendar',
      )
    } catch {
      materializeRecurrenceDialog.value = {
        ...materializeRecurrenceDialog.value,
        isSubmitting: false,
      }
    }
  }

  function translateCalendarLabel(
    key: string,
    germanFallback: string,
    englishFallback: string,
    parameters?: Record<string, unknown>,
  ): string {
    const translationKey = `calendar.${key}`
    if (i18n.global.te(translationKey)) {
      return i18n.global.t(translationKey, parameters ?? {})
    }

    return String(i18n.global.locale.value).toLowerCase().startsWith('de')
      ? germanFallback
      : englishFallback
  }

  function openCopyDialogFromContextMenu() {
    const item = eventContextMenu.value.item
    if (!item) {
      return
    }

    const copiedItem = createSaplingRecordCopy(item, options.templates.value)

    options.editEvent.value = toCalendarEvent(copiedItem as EventItem)
    applyCalendarEventDateParts(options.editEvent.value)
    options.forceEditDialogDirtyFields.value = []
    options.clearDragSnapshot()
    options.showEditDialog.value = true
  }

  function openTimelineFromContextMenu() {
    const itemHandle = eventContextMenu.value.item?.handle
    if (itemHandle != null) {
      timelineDialogStore.openTimeline('event', itemHandle)
    }
  }

  function openChangeLogFromContextMenu() {
    const itemHandle = eventContextMenu.value.item?.handle
    if (itemHandle != null) {
      changeLogDialogStore.openChangeLog('event', itemHandle)
    }
  }

  function navigateToAddressFromContextMenu() {
    const item = eventContextMenu.value.item
    if (!item || !canNavigate.value) {
      return
    }

    const address = options.templates.value
      .filter((template) => template.options?.includes('isNavigation'))
      .map((template) => item[template.name || ''])
      .filter(Boolean)
      .join(' ')

    if (address) {
      window.open(`${NAVIGATION_URL}${encodeURIComponent(address)}`, '_blank')
    }
  }

  async function openUploadDialogFromContextMenu() {
    const item = eventContextMenu.value.item
    if (!item || eventEntityPermission.value?.allowInsert !== true || item.handle == null) {
      return
    }

    try {
      const openedInDvelop = await openDvelopUploadDialog(
        options.entityEvent.value?.handle ?? 'event',
        String(item.handle),
      )
      if (openedInDvelop) {
        return
      }
    } catch {
      return
    }

    uploadDialogItem.value = item
    showUploadDialog.value = true
  }

  async function navigateToDocumentsFromContextMenu() {
    const itemHandle = eventContextMenu.value.item?.handle
    if (itemHandle == null) {
      return
    }

    try {
      await openDocumentView(options.entityEvent.value?.handle ?? 'event', String(itemHandle))
    } catch {
      return
    }
  }

  function openInformationDialogFromContextMenu() {
    const item = eventContextMenu.value.item
    if (!item || !canShowInformation.value) {
      return
    }

    informationDialogItem.value = item
    showInformationDialog.value = true
  }

  async function runScriptButtonFromContextMenu(scriptButton: ScriptButtonItem) {
    const item = eventContextMenu.value.item
    const entity = options.entityEvent.value
    if (!entity || !item) {
      return
    }

    const executionKey = buildScriptButtonExecutionKey(scriptButton, [item])
    const scriptEntity = entity.handle || 'event'
    if (runningScriptButtonKeys.has(executionKey)) {
      pushScriptButtonAlreadyRunningMessage({
        button: scriptButton,
        entity: scriptEntity,
        pushMessage,
        translate: i18n.global.t,
        hasTranslation: i18n.global.te,
      })
      return
    }

    runningScriptButtonKeys.add(executionKey)
    pushScriptButtonStartedMessage({
      button: scriptButton,
      entity: scriptEntity,
      itemCount: 1,
      pushMessage,
      translate: i18n.global.t,
      hasTranslation: i18n.global.te,
    })

    try {
      await currentPersonStore.fetchCurrentPerson()
      if (!currentPersonStore.person) {
        return
      }

      const result = await ApiScriptService.runClient(
        [item],
        entity,
        currentPersonStore.person,
        scriptButton.name,
        scriptButton.parameter,
      )
      await handleScriptResultClient(result, { entity: scriptEntity, pushMessage })

      if (result.isSuccess !== false) {
        await options.refreshVisibleEvents()
      }
    } catch {
      // API errors are already routed through the shared message center.
    } finally {
      runningScriptButtonKeys.delete(executionKey)
    }
  }

  async function handleEventContextMenuAction(menuItem: SaplingContextMenuTableMenuItem) {
    closeEventContextMenu()

    switch (menuItem.type) {
      case 'copy':
        openCopyDialogFromContextMenu()
        break
      case 'dissolveRecurrence':
        openMaterializeRecurrenceDialog()
        break
      case 'changeLog':
        openChangeLogFromContextMenu()
        break
      case 'timeline':
        openTimelineFromContextMenu()
        break
      case 'navigate':
        navigateToAddressFromContextMenu()
        break
      case 'uploadDocument':
        void openUploadDialogFromContextMenu()
        break
      case 'showDocuments':
        void navigateToDocumentsFromContextMenu()
        break
      case 'showInformation':
        openInformationDialogFromContextMenu()
        break
      case 'mail':
        if (menuItem.mailAction?.email) {
          openMailDialog({
            entityHandle: options.entityEvent.value?.handle ?? 'event',
            itemHandle: eventContextMenu.value.item?.handle ?? undefined,
            draftValues: eventContextMenu.value.item ?? undefined,
            initialTo: [menuItem.mailAction.email],
          })
        }
        break
      case 'script':
        if (menuItem.scriptButton) {
          await runScriptButtonFromContextMenu(menuItem.scriptButton)
        }
        break
      default:
        break
    }
  }

  return {
    closeEventContextMenu,
    closeInformationDialog,
    closeMaterializeRecurrenceDialog,
    closeUploadDialog,
    confirmMaterializeRecurrence,
    eventContextMenu,
    eventContextMenuItems,
    eventContextMenuStyle,
    handleEventContextMenuAction,
    informationDialogItem,
    loadEventScriptButtons,
    materializeRecurrenceDialog,
    openEventContextMenu,
    showInformationDialog,
    showUploadDialog,
    uploadDialogItem,
  }
}
