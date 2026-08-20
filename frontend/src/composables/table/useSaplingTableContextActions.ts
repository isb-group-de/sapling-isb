import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { EntityTemplate } from '@/entity/structure'
import type { SaplingGenericItem, ScriptButtonItem } from '@/entity/entity'
import { NAVIGATION_URL } from '@/constants/project.constants'
import { useCurrentPermissionStore } from '@/stores/currentPermissionStore'
import { useTimelineDialogStore } from '@/stores/timelineDialogStore'
import { useChangeLogDialogStore } from '@/stores/changeLogDialogStore'
import { useSaplingMailDialog } from '@/composables/dialog/useSaplingMailDialog'
import { buildMailMenuActions, loadCustomerContactMailActions } from '@/utils/saplingMailMenuUtil'
import { openDocumentView, openDvelopUploadDialog } from '@/utils/saplingDocumentActionUtil'
import type { SaplingContextMenuTableActionPayload } from '@/composables/context/useSaplingContextMenuTable'
import type { SaplingTableRowContextMenuOpenPayload } from '@/composables/table/useSaplingTableRow'

interface TableContextMenuState {
  visible: boolean
  item: SaplingGenericItem | null
  x: number
  y: number
}

interface SaplingTableContextProps {
  entityHandle: string
  entityTemplates: EntityTemplate[]
  showActions?: boolean
}

interface UseSaplingTableContextActionsOptions {
  props: SaplingTableContextProps
  loadItem: (item: SaplingGenericItem) => Promise<SaplingGenericItem>
  editItem: (item: SaplingGenericItem) => void | Promise<void>
  showItem: (item: SaplingGenericItem) => void | Promise<void>
  copyItem: (item: SaplingGenericItem) => void
  deleteItem: (item: SaplingGenericItem) => void
  runScript: (payload: { button: ScriptButtonItem; item: SaplingGenericItem }) => void
}

/** Owns reusable context-menu and related side-action state for generic tables. */
export function useSaplingTableContextActions({
  props,
  loadItem,
  editItem,
  showItem,
  copyItem,
  deleteItem,
  runScript,
}: UseSaplingTableContextActionsOptions) {
  const currentPermissionStore = useCurrentPermissionStore()
  const router = useRouter()
  const timelineDialogStore = useTimelineDialogStore()
  const changeLogDialogStore = useChangeLogDialogStore()
  const { openMailDialog } = useSaplingMailDialog()
  const showUploadDialog = ref(false)
  const uploadDialogItem = ref<SaplingGenericItem | null>(null)
  const showInformationDialog = ref(false)
  const informationDialogItem = ref<SaplingGenericItem | null>(null)
  const showExternalRecordLinksDialog = ref(false)
  const externalRecordLinksDialogItem = ref<SaplingGenericItem | null>(null)
  const customerContactMailActions = ref<ReturnType<typeof buildMailMenuActions>>([])
  const contextMenu = ref<TableContextMenuState>({
    visible: false,
    item: null,
    x: 0,
    y: 0,
  })

  const canNavigate = computed(() =>
    props.entityTemplates.some((template) => template.options?.includes('isNavigation')),
  )
  const canShowInformation = computed(
    () =>
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === 'information' && permission.allowRead,
      ) ?? false,
  )
  const contextMenuMailActions = computed(() => [
    ...buildMailMenuActions(props.entityTemplates, contextMenu.value.item),
    ...customerContactMailActions.value,
  ])

  async function openContextMenu({ item, x, y }: SaplingTableRowContextMenuOpenPayload) {
    if (props.showActions === false) {
      contextMenu.value = { ...contextMenu.value, visible: false }
      return
    }

    const loadedItem = await loadItem(item)
    const canReadPerson =
      currentPermissionStore.accumulatedPermission?.some(
        (permission) => permission.entityHandle === 'person' && permission.allowRead,
      ) ?? false
    try {
      customerContactMailActions.value = await loadCustomerContactMailActions(
        props.entityTemplates,
        loadedItem,
        canReadPerson,
      )
    } catch {
      customerContactMailActions.value = []
    }

    contextMenu.value = {
      visible: true,
      item: loadedItem,
      x,
      y,
    }
  }

  function closeContextMenu() {
    contextMenu.value = { ...contextMenu.value, visible: false }
    customerContactMailActions.value = []
  }

  async function openUploadDialog(item: SaplingGenericItem) {
    if (item.handle == null) {
      return
    }

    try {
      if (await openDvelopUploadDialog(props.entityHandle, String(item.handle))) {
        return
      }
    } catch {
      return
    }

    uploadDialogItem.value = item
    showUploadDialog.value = true
  }

  function closeUploadDialog() {
    showUploadDialog.value = false
    uploadDialogItem.value = null
  }

  function openInformationDialog(item: SaplingGenericItem) {
    informationDialogItem.value = item
    showInformationDialog.value = true
  }

  function closeInformationDialog() {
    showInformationDialog.value = false
    informationDialogItem.value = null
  }

  function openExternalRecordLinksDialog(item: SaplingGenericItem) {
    if (item.handle == null) {
      return
    }

    externalRecordLinksDialogItem.value = item
    showExternalRecordLinksDialog.value = true
  }

  function closeExternalRecordLinksDialog() {
    showExternalRecordLinksDialog.value = false
    externalRecordLinksDialogItem.value = null
  }

  function navigateToAddress(item: SaplingGenericItem) {
    if (!canNavigate.value) {
      return
    }

    const address = props.entityTemplates
      .filter((template) => template.options?.includes('isNavigation'))
      .map((template) => item[template.name || ''])
      .filter(Boolean)
      .join(' ')

    if (address) {
      window.open(`${NAVIGATION_URL}${encodeURIComponent(address)}`, '_blank')
    }
  }

  function openTimeline(item: SaplingGenericItem) {
    if (item.handle != null) {
      timelineDialogStore.openTimeline(props.entityHandle, String(item.handle))
    }
  }

  function openChangeLog(item: SaplingGenericItem) {
    if (item.handle != null) {
      changeLogDialogStore.openChangeLog(props.entityHandle, String(item.handle))
    }
  }

  async function navigateToDocuments(item: SaplingGenericItem) {
    if (item.handle == null) {
      return
    }

    try {
      await openDocumentView(props.entityHandle, String(item.handle))
    } catch {
      // Document service errors are handled by the shared API layer.
    }
  }

  function onContextMenuAction({
    type,
    item,
    scriptButton,
    mailAction,
  }: SaplingContextMenuTableActionPayload) {
    const actions: Partial<Record<SaplingContextMenuTableActionPayload['type'], () => void>> = {
      edit: () => void editItem(item),
      changeLog: () => openChangeLog(item),
      show: () => void showItem(item),
      delete: () => deleteItem(item),
      copy: () => copyItem(item),
      customer360: () => {
        if (item.handle != null && ['company', 'person'].includes(props.entityHandle)) {
          void router.push({
            name: 'customer360',
            params: { entityHandle: props.entityHandle, handle: String(item.handle) },
          })
        }
      },
      navigate: () => navigateToAddress(item),
      timeline: () => openTimeline(item),
      uploadDocument: () => void openUploadDialog(item),
      showDocuments: () => void navigateToDocuments(item),
      showInformation: () => openInformationDialog(item),
      showExternalRecordLinks: () => openExternalRecordLinksDialog(item),
      mail: () => {
        if (mailAction?.email) {
          openMailDialog({
            entityHandle: props.entityHandle,
            itemHandle: item.handle as string | number | undefined,
            draftValues: item,
            initialTo: [mailAction.email],
          })
        }
      },
      script: () => {
        if (scriptButton) {
          runScript({ button: scriptButton, item })
        }
      },
    }

    actions[type]?.()
    closeContextMenu()
  }

  return {
    canNavigate,
    canShowInformation,
    contextMenu,
    contextMenuMailActions,
    showUploadDialog,
    uploadDialogItem,
    showInformationDialog,
    informationDialogItem,
    showExternalRecordLinksDialog,
    externalRecordLinksDialogItem,
    openContextMenu,
    closeContextMenu,
    onContextMenuAction,
    navigateToAddress,
    openTimeline,
    openChangeLog,
    openUploadDialog,
    closeUploadDialog,
    navigateToDocuments,
    openInformationDialog,
    closeInformationDialog,
    openExternalRecordLinksDialog,
    closeExternalRecordLinksDialog,
  }
}
